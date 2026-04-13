import { trackMetricEvent } from '../_lib/metrics.js';
import {
  DEFAULT_TRACKING_CONFIG,
  getSetting,
  normalizeTrackingConfig
} from '../_lib/settings.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body || {};
    const status = payload?.status || payload?.data?.status;
    const isPaid = status === 'paid';

    if (isPaid) {
      const amount = (payload?.data?.amount || payload?.amount || 0) / 100;
      const customerName = payload?.data?.customer?.name || 'Cliente';
      const itemTitle = payload?.data?.items?.[0]?.title || 'Pedido';
      const amountStr = `R$${amount.toFixed(2).replace('.', ',')}`;
      const description = `${customerName} • ${amountStr} • ${itemTitle}`;
      const config = normalizeTrackingConfig(await getSetting('tracking_config', DEFAULT_TRACKING_CONFIG));

      await trackMetricEvent({
        sessionId: payload?.data?.id || payload?.id || null,
        eventName: 'Purchase',
        metadata: {
          amount,
          customerName,
          itemTitle,
          description,
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
