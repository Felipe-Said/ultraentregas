import { trackMetricEvent } from '../_lib/metrics.js';
import {
  DEFAULT_TRACKING_CONFIG,
  getSetting,
  normalizeTrackingConfig
} from '../_lib/settings.js';
import { getSupabase } from '../_lib/supabase.js';

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
    const status = transaction?.status || payload?.status || '';
    const paymentMethod = transaction?.paymentMethod || payload?.paymentMethod || '';
    const transactionId = String(transaction?.id || payload?.objectId || payload?.id || '');
    const externalRef = String(transaction?.externalRef || payload?.externalRef || '');
    const transactionKey = transactionId || externalRef;
    const isPaid = status === 'paid' && (!paymentMethod || paymentMethod === 'pix');

    if (isPaid) {
      if (await hasTrackedPurchase(transactionKey)) {
        return res.status(200).json({ ok: true, duplicate: true });
      }

      const amount = (transaction?.paidAmount || transaction?.amount || 0) / 100;
      const customerName = transaction?.customer?.name || 'Cliente';
      const itemTitle = transaction?.items?.[0]?.title || 'Pedido';
      const amountStr = `R$${amount.toFixed(2).replace('.', ',')}`;
      const description = `${customerName} • ${amountStr} • ${itemTitle}`;
      const config = normalizeTrackingConfig(await getSetting('tracking_config', DEFAULT_TRACKING_CONFIG));

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
          await fetch(pushcut.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: 'Venda Paga!',
              text: description
            })
          });
        } catch (error) {
          console.error('[Pushcut Error]', error.message);
        }
      }

      for (const pixel of config.pixels) {
        try {
          const eventData = {
            data: [{
              event_name: 'Purchase',
              event_time: Math.floor(Date.now() / 1000),
              action_source: 'website',
              custom_data: {
                value: amount,
                currency: 'BRL',
                content_type: 'product',
                content_name: itemTitle
              }
            }]
          };

          await fetch(
            `https://graph.facebook.com/v18.0/${pixel.id}/events?access_token=${pixel.token}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(eventData)
            }
          );
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
