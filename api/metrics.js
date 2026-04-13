import { getMetricsSummary } from './_lib/metrics.js';
import { requireAdmin } from './_lib/admin-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    requireAdmin(req);
    const requestedDate = Array.isArray(req.query?.date) ? req.query.date[0] : req.query?.date;
    const metrics = await getMetricsSummary(requestedDate);
    return res.status(200).json(metrics);
  } catch (error) {
    const status = /token/i.test(error.message) ? 401 : 500;
    return res.status(status).json({ error: error.message });
  }
}
