import { getSupabase } from '../_lib/supabase.js';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getQueryValue(req, key) {
  const directValue = req.query?.[key];

  if (typeof directValue === 'string' && directValue.trim()) {
    return directValue.trim();
  }

  const requestUrl = typeof req.url === 'string' ? req.url : '';
  const searchParams = new URL(requestUrl, 'http://localhost').searchParams;
  return normalizeString(searchParams.get(key));
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const transactionId = normalizeString(
    getQueryValue(req, 'transactionId') || getQueryValue(req, 'id')
  );

  if (!transactionId) {
    return res.status(400).json({ error: 'transactionId is required' });
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('metrics_events')
      .select('event_name, created_at, metadata')
      .eq('user_id', transactionId)
      .in('event_name', ['Order_Generated', 'Purchase'])
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      throw error;
    }

    const events = data || [];
    const purchaseEvent = events.find((event) => event.event_name === 'Purchase');
    const generatedEvent = events.find((event) => event.event_name === 'Order_Generated');
    const latestEvent = purchaseEvent || generatedEvent || null;

    return res.status(200).json({
      ok: true,
      transactionId,
      status: purchaseEvent ? 'paid' : generatedEvent ? 'waiting_payment' : 'not_found',
      paid: Boolean(purchaseEvent),
      paidAt: purchaseEvent?.created_at || null,
      amount: latestEvent?.metadata?.amount ?? null,
      customerName: normalizeString(latestEvent?.metadata?.customerName),
      itemTitle: normalizeString(latestEvent?.metadata?.itemTitle)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
