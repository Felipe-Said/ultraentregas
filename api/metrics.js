import { supabase } from './_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Fetch counts
    const { count: purchaseCount } = await supabase
      .from('metrics_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_name', 'Purchase');

    // 2. Fetch recent logs
    const { data: logs, error: lError } = await supabase
      .from('metrics_events')
      .select('created_at, event_name, event_desc, user_id')
      .order('created_at', { ascending: false })
      .limit(10);

    // Note: Views and other metrics would ideally come from another table 
    // or be counted from metrics_events.
    // For now, we'll return what we have.

    return res.status(200).json({
      views: 0, // In real prod, these would be tracked via /api/track
      whatsappClicks: 0,
      cepFills: 0,
      totalSales: purchaseCount || 0,
      logs: logs?.map(l => ({
        time: new Date(l.created_at).toLocaleTimeString(),
        event: l.event_name,
        desc: l.event_desc,
        user: l.user_id || 'u-unknown'
      })) || []
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
