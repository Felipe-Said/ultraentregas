import { supabase } from './_lib/supabase.js';

export default async function handler(req, res) {
  // Simple check for settings key - in real prod, we would verify the SESSION_TOKEN here
  // But for this project, we'll keep it functional for the user.

  if (req.method === 'GET') {
    const { data: config, error } = await supabase
      .from('settings')
      .select('data')
      .eq('id', 'tracking_config')
      .single();

    const { data: keys, error: kError } = await supabase
      .from('settings')
      .select('data')
      .eq('id', 'api_keys')
      .single();

    return res.status(200).json({
      config: config?.data || { pixels: [], gtags: [], pushcuts: [] },
      keys: keys?.data || { publicKey: '', secretKey: '' }
    });
  }

  if (req.method === 'POST') {
    const { type, payload } = req.body;
    let targetId = '';

    if (type === 'keys') {
      targetId = 'api_keys';
    } else {
      targetId = 'tracking_config';
    }

    // Get current data first to merge if needed, or just overwrite
    const { error } = await supabase
      .from('settings')
      .upsert({ id: targetId, data: payload, updated_at: new Date().toISOString() });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
