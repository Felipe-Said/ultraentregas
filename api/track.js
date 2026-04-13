import { trackMetricEvent } from './_lib/metrics.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { session_id: sessionId, event, data } = req.body || {};

    if (!event) {
      return res.status(400).json({ error: 'event is required' });
    }

    await trackMetricEvent({
      sessionId,
      eventName: event,
      metadata: data || {}
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
