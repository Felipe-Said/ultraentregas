import { supabase } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const payload = req.body;
  const status = payload?.status || payload?.data?.status;
  const isPaid = status === 'paid';

  if (isPaid) {
    const amount = (payload?.data?.amount || payload?.amount || 0) / 100;
    const customerName = payload?.data?.customer?.name || 'Cliente';
    const itemTitle = payload?.data?.items?.[0]?.title || 'Pedido';
    const amountStr = `R$${amount.toFixed(2).replace('.', ',')}`;

    console.log(`[💰 VENDA PAGA] ${customerName} — ${amountStr}`);

    // 1. Fetch config from Supabase
    const { data: configRecord } = await supabase
      .from('settings')
      .select('data')
      .eq('id', 'tracking_config')
      .single();

    const config = configRecord?.data || { pixels: [], gtags: [], pushcuts: [] };

    // 2. Log metric to Supabase
    await supabase.from('metrics_events').insert({
      event_name: 'Purchase',
      event_desc: `${customerName} — ${amountStr} — ${itemTitle}`,
      metadata: { amount, customerName, itemTitle, payload }
    });

    // 3. Process Pushcut notifications
    for (const pc of config.pushcuts || []) {
      if (!pc.url) continue;
      try {
        await fetch(pc.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: '💰 Venda Paga!',
            text: `${customerName} — ${amountStr} — ${itemTitle}`
          })
        });
      } catch (err) { console.error('[Pushcut Error]', err.message); }
    }

    // 4. Process Facebook Pixels (CAPI)
    for (const px of config.pixels || []) {
      if (!px.id || !px.token) continue;
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
          `https://graph.facebook.com/v18.0/${px.id}/events?access_token=${px.token}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(eventData)
          }
        );
      } catch (err) { console.error(`[Pixel Error] ID ${px.id}:`, err.message); }
    }
  }

  return res.status(200).json({ ok: true });
}
