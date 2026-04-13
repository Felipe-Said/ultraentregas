import {
  DEFAULT_API_KEYS,
  DEFAULT_TRACKING_CONFIG,
  getSetting,
  normalizeApiKeys,
  normalizeTrackingConfig,
  upsertSetting
} from './_lib/settings.js';
import { requireAdmin } from './_lib/admin-auth.js';

export default async function handler(req, res) {
  try {
    requireAdmin(req);

    if (req.method === 'GET') {
      const [config, keys] = await Promise.all([
        getSetting('tracking_config', DEFAULT_TRACKING_CONFIG),
        getSetting('api_keys', DEFAULT_API_KEYS)
      ]);

      return res.status(200).json({
        config: normalizeTrackingConfig(config),
        keys: normalizeApiKeys(keys)
      });
    }

    if (req.method === 'POST') {
      const { type, payload } = req.body || {};

      if (type === 'keys') {
        await upsertSetting('api_keys', normalizeApiKeys(payload));
      } else if (type === 'config') {
        await upsertSetting('tracking_config', normalizeTrackingConfig(payload));
      } else {
        return res.status(400).json({ error: 'Invalid settings type' });
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    const status = /token/i.test(error.message) ? 401 : 500;
    return res.status(status).json({ error: error.message });
  }
}
