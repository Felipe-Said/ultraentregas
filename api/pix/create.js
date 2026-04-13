import { DEFAULT_API_KEYS, getSetting, normalizeApiKeys } from '../_lib/settings.js';

function getNestedValue(source, path) {
  return path.split('.').reduce((value, key) => {
    if (value && typeof value === 'object' && key in value) {
      return value[key];
    }

    return undefined;
  }, source);
}

function pickFirstString(source, paths) {
  for (const path of paths) {
    const value = getNestedValue(source, path);

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function normalizeQrCodeImage(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed) || /^data:image\//i.test(trimmed)) {
    return trimmed;
  }

  const base64 = trimmed.replace(/\s+/g, '');

  if (/^[A-Za-z0-9+/=]+$/.test(base64) && base64.length > 128) {
    return `data:image/png;base64,${base64}`;
  }

  return '';
}

function extractPixResponse(payload) {
  const pixCode = pickFirstString(payload, [
    'pixCode',
    'data.pix.qrcode',
    'data.pix.qrCode',
    'data.pix.copyPaste',
    'data.pix.copy_paste',
    'data.pix.emv',
    'data.pix.payload',
    'pix.qrcode',
    'pix.qrCode',
    'pix.copyPaste',
    'pix.copy_paste',
    'pix.emv',
    'pix.payload',
    'qrcode',
    'qrCode',
    'copyPaste',
    'copy_paste',
    'emv',
    'payload'
  ]);

  const qrCodeImage = normalizeQrCodeImage(pickFirstString(payload, [
    'qrCodeImage',
    'data.pix.qrCodeImage',
    'data.pix.qrcodeImage',
    'data.pix.qrCodeBase64',
    'data.pix.qrcodeBase64',
    'data.pix.base64Image',
    'data.pix.image',
    'pix.qrCodeImage',
    'pix.qrcodeImage',
    'pix.qrCodeBase64',
    'pix.qrcodeBase64',
    'pix.base64Image',
    'pix.image',
    'image',
    'base64Image'
  ]));

  const expirationDate = pickFirstString(payload, [
    'expirationDate',
    'expiresAt',
    'expires_at',
    'data.pix.expirationDate',
    'data.pix.expiresAt',
    'data.pix.expires_at',
    'pix.expirationDate',
    'pix.expiresAt',
    'pix.expires_at'
  ]);

  const transactionId = pickFirstString(payload, [
    'id',
    'transactionId',
    'transaction_id',
    'data.id',
    'data.transactionId',
    'data.transaction_id',
    'pix.id'
  ]);

  return {
    pixCode,
    qrCodeImage,
    expirationDate,
    transactionId
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const keys = normalizeApiKeys(await getSetting('api_keys', DEFAULT_API_KEYS));

    if (!keys.publicKey || !keys.secretKey) {
      return res.status(400).json({ error: 'API keys not configured in Supabase.' });
    }

    const { amount, items, customer, shipping } = req.body || {};

    if (!amount || !customer?.name || !customer?.email || !customer?.cpf) {
      return res.status(400).json({
        error: 'amount, customer.name, customer.email and customer.cpf are required'
      });
    }

    const auth = Buffer.from(`${keys.publicKey}:${keys.secretKey}`).toString('base64');
    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || (host?.includes('localhost') ? 'http' : 'https');
    const postbackUrl = `${protocol}://${host}/api/pix/webhook`;

    const body = {
      amount: Math.round(amount),
      paymentMethod: 'pix',
      postbackUrl,
      items: items || [{
        title: 'Pedido AquaGas',
        unitPrice: Math.round(amount),
        quantity: 1,
        tangible: true
      }],
      customer: {
        name: customer.name,
        email: customer.email,
        phoneNumber: customer.phone?.replace(/\D/g, '') || '',
        document: {
          number: customer.cpf?.replace(/\D/g, '') || '',
          type: 'cpf'
        }
      },
      shipping: shipping ? {
        address: {
          street: shipping.rua || '',
          streetNumber: shipping.numero || '',
          neighborhood: shipping.bairro || '',
          city: shipping.cidade || '',
          state: shipping.uf || '',
          zipcode: shipping.cep?.replace(/\D/g, '') || ''
        }
      } : undefined
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    let response;

    try {
      response = await fetch('https://api.titanshub.io/v1/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${auth}`
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const rawText = await response.text();
    let data = {};

    if (rawText) {
      try {
        data = JSON.parse(rawText);
      } catch {
        data = { raw: rawText };
      }
    }

    const normalized = extractPixResponse(data);

    if (!response.ok) {
      const providerError = pickFirstString(data, [
        'error',
        'message',
        'detail',
        'details',
        'data.message'
      ]);

      return res.status(response.status).json({
        error: providerError || 'Erro ao gerar Pix com o provedor.',
        details: data
      });
    }

    if (!normalized.pixCode) {
      return res.status(502).json({
        error: 'O provedor retornou a transacao, mas sem o codigo Pix.',
        details: data
      });
    }

    return res.status(200).json({
      ok: true,
      pixCode: normalized.pixCode,
      qrCodeImage: normalized.qrCodeImage,
      expirationDate: normalized.expirationDate,
      transactionId: normalized.transactionId,
      pix: {
        qrcode: normalized.pixCode,
        qrCodeImage: normalized.qrCodeImage,
        expirationDate: normalized.expirationDate,
        transactionId: normalized.transactionId
      },
      raw: data
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({
        error: 'A geracao do Pix demorou demais para responder. Tente novamente.'
      });
    }

    return res.status(500).json({ error: 'Titans Hub connection error', details: error.message });
  }
}
