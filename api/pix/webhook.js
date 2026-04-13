import { createHash } from 'node:crypto';

import { trackMetricEvent } from '../_lib/metrics.js';
import {
  DEFAULT_TRACKING_CONFIG,
  getSetting,
  normalizeTrackingConfig
} from '../_lib/settings.js';
import { getSupabase } from '../_lib/supabase.js';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeDigits(value) {
  return normalizeString(value).replace(/\D/g, '');
}

function hashValue(value) {
  const normalizedValue = normalizeString(value).toLowerCase();

  if (!normalizedValue) {
    return '';
  }

  return createHash('sha256').update(normalizedValue).digest('hex');
}

function getRequestIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;

  if (typeof forwardedIp === 'string' && forwardedIp.trim()) {
    return forwardedIp.split(',')[0].trim();
  }

  return normalizeString(req.headers['x-real-ip'] || req.socket?.remoteAddress || '');
}

function buildFacebookUserData(transaction, req) {
  const customer = transaction?.customer || {};
  const customerName = normalizeString(customer.name);
  const [firstName = '', ...lastNameParts] = customerName.split(' ');
  const lastName = lastNameParts.join(' ');
  const userData = {
    em: hashValue(customer.email),
    ph: hashValue(normalizeDigits(customer.phone || customer.phoneNumber)),
    fn: hashValue(firstName),
    ln: hashValue(lastName),
    client_ip_address: getRequestIp(req)
  };

  return Object.fromEntries(
    Object.entries(userData).filter(([, value]) => normalizeString(value))
  );
}

async function readResponsePayload(response) {
  const rawText = await response.text();

  if (!rawText) {
    return {};
  }

  try {
    return JSON.parse(rawText);
  } catch {
    return { raw: rawText };
  }
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = await readResponsePayload(response);

  if (!response.ok) {
    const errorMessage = normalizeString(payload?.error?.message || payload?.message || payload?.error || payload?.raw);
    throw new Error(errorMessage || `HTTP ${response.status}`);
  }

  return payload;
}

async function hasTrackedPurchase(transactionKey) {
  if (!transactionKey) {
    return false;
  }

  const supabase = getSupabase();
  const { count, error } = await supabase
    .from('metrics_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_name', 'Purchase')
    .eq('user_id', transactionKey);

  if (error) {
    throw error;
  }

  return (count || 0) > 0;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body || {};
    const transaction = payload?.data || payload;
    const status = normalizeString(transaction?.status || payload?.status).toLowerCase();
    const paymentMethod = normalizeString(transaction?.paymentMethod || payload?.paymentMethod).toLowerCase();
    const transactionId = normalizeString(transaction?.id || payload?.objectId || payload?.id);
    const externalRef = normalizeString(transaction?.externalRef || payload?.externalRef);
    const transactionKey = transactionId || externalRef;
    const isPaid = status === 'paid' && (!paymentMethod || paymentMethod === 'pix');

    if (isPaid) {
      if (await hasTrackedPurchase(transactionKey)) {
        return res.status(200).json({ ok: true, duplicate: true });
      }

      const amount = Number(transaction?.paidAmount || transaction?.amount || 0) / 100;
      const customerName = normalizeString(transaction?.customer?.name) || 'Cliente';
      const itemTitle = normalizeString(transaction?.items?.[0]?.title) || 'Pedido';
      const amountStr = `R$${amount.toFixed(2).replace('.', ',')}`;
      const description = `${customerName} - ${amountStr} - ${itemTitle}`;
      const config = normalizeTrackingConfig(await getSetting('tracking_config', DEFAULT_TRACKING_CONFIG));
      const host = normalizeString(req.headers.host);
      const protocol = normalizeString(req.headers['x-forwarded-proto']) || (host.includes('localhost') ? 'http' : 'https');
      const eventSourceUrl = host ? `${protocol}://${host}/checkout.html` : undefined;

      await trackMetricEvent({
        sessionId: transactionKey || null,
        eventName: 'Purchase',
        metadata: {
          transactionId,
          externalRef,
          status,
          paymentMethod,
          amount,
          customerName,
          itemTitle,
          description,
          receiptUrl: transaction?.pix?.receiptUrl || null,
          end2EndId: transaction?.pix?.end2EndId || null,
          payload
        }
      });

      for (const pushcut of config.pushcuts) {
        try {
          await postJson(pushcut.url, {
            title: 'Venda paga!',
            text: description
          });
        } catch (error) {
          console.error(`[Pushcut Error] ${pushcut.url}:`, error.message);
        }
      }

      const facebookUserData = buildFacebookUserData(transaction, req);

      for (const pixel of config.pixels) {
        try {
          const eventPayload = {
            event_name: 'Purchase',
            event_time: Math.floor(Date.now() / 1000),
            event_id: transactionKey || undefined,
            action_source: 'website',
            event_source_url: eventSourceUrl,
            custom_data: {
              value: amount,
              currency: 'BRL',
              content_type: 'product',
              content_name: itemTitle
            }
          };

          if (Object.keys(facebookUserData).length > 0) {
            eventPayload.user_data = facebookUserData;
          }

          const eventData = {
            data: [eventPayload]
          };

          const response = await fetch(
            `https://graph.facebook.com/v18.0/${pixel.id}/events?access_token=${pixel.token}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(eventData)
            }
          );
          const responsePayload = await readResponsePayload(response);

          if (!response.ok || responsePayload?.error) {
            const errorMessage = normalizeString(
              responsePayload?.error?.message
              || responsePayload?.message
              || responsePayload?.error
              || responsePayload?.raw
            );
            throw new Error(errorMessage || `HTTP ${response.status}`);
          }
        } catch (error) {
          console.error(`[Pixel Error] ID ${pixel.id}:`, error.message);
        }
      }
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
