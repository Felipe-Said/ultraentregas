import { requireAdmin } from '../_lib/admin-auth.js';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
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

export default async function handler(req, res) {
  try {
    requireAdmin(req);

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const url = normalizeString(req.body?.url);

    if (!url) {
      return res.status(400).json({ error: 'Webhook URL is required' });
    }

    const payload = {
      title: 'Teste de notificacao',
      text: `Pushcut configurado com sucesso em ${new Date().toLocaleString('pt-BR')}`
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const responsePayload = await readResponsePayload(response);

    if (!response.ok) {
      const errorMessage = normalizeString(
        responsePayload?.error?.message
        || responsePayload?.message
        || responsePayload?.error
        || responsePayload?.raw
      );

      return res.status(502).json({
        error: errorMessage || `Webhook respondeu HTTP ${response.status}`
      });
    }

    return res.status(200).json({
      ok: true,
      message: 'Notificacao de teste enviada com sucesso'
    });
  } catch (error) {
    const status = /token/i.test(error.message) ? 401 : 500;
    return res.status(status).json({ error: error.message });
  }
}
