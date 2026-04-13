import { DEFAULT_API_KEYS, getSetting, normalizeApiKeys } from '../_lib/settings.js';
import { trackMetricEvent } from '../_lib/metrics.js';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeDigits(value) {
  return normalizeString(value).replace(/\D/g, '');
}

function getRequestIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;

  if (typeof forwardedIp === 'string' && forwardedIp.trim()) {
    return forwardedIp.split(',')[0].trim();
  }

  return normalizeString(req.headers['x-real-ip'] || req.socket?.remoteAddress || '');
}

function buildExternalRef() {
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `aquagas-${Date.now()}-${randomSuffix}`;
}

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
    const customerPhone = normalizeDigits(customer?.phone);
    const customerCpf = normalizeDigits(customer?.cpf);
    const normalizedItems = Array.isArray(items) && items.length
      ? items.map((item, index) => ({
          title: normalizeString(item?.title) || `Pedido AquaGas ${index + 1}`,
          unitPrice: Math.round(Number(item?.unitPrice || 0)),
          quantity: Math.max(1, Math.round(Number(item?.quantity || 1))),
          tangible: item?.tangible !== false,
          externalRef: normalizeString(item?.externalRef) || `item-${index + 1}`
        }))
      : [{
          title: 'Pedido AquaGas',
          unitPrice: Math.round(amount),
          quantity: 1,
          tangible: true,
          externalRef: 'item-1'
        }];
    const requiresShipping = normalizedItems.some((item) => item.tangible);
    const shippingAddress = shipping ? {
      street: normalizeString(shipping.rua || shipping.street),
      streetNumber: normalizeString(shipping.numero || shipping.streetNumber),
      neighborhood: normalizeString(shipping.bairro || shipping.neighborhood),
      city: normalizeString(shipping.cidade || shipping.city),
      state: normalizeString(shipping.uf || shipping.state).toUpperCase(),
      zipCode: normalizeDigits(shipping.cep || shipping.zipCode || shipping.zipcode),
      country: normalizeString(shipping.country || 'BR').toUpperCase(),
      complement: normalizeString(shipping.complemento || shipping.complement)
    } : null;
    const externalRef = buildExternalRef();
    const ip = getRequestIp(req);

    if (!amount || !customer?.name || !customer?.email || !customerCpf || !customerPhone) {
      return res.status(400).json({
        error: 'amount, customer.name, customer.email, customer.cpf and customer.phone are required'
      });
    }

    if (requiresShipping) {
      const hasValidShipping = shippingAddress
        && shippingAddress.street
        && shippingAddress.streetNumber
        && shippingAddress.neighborhood
        && shippingAddress.city
        && shippingAddress.state.length === 2
        && shippingAddress.zipCode.length === 8
        && shippingAddress.country.length === 2;

      if (!hasValidShipping) {
        return res.status(400).json({
          error: 'shipping.address.street, streetNumber, neighborhood, city, state, zipCode and country are required for tangible items'
        });
      }
    }

    const auth = Buffer.from(`${keys.publicKey}:${keys.secretKey}`).toString('base64');
    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || (host?.includes('localhost') ? 'http' : 'https');
    const postbackUrl = `${protocol}://${host}/api/pix/webhook`;
    const metadata = JSON.stringify({
      source: 'aquagas-checkout',
      externalRef,
      itemCount: normalizedItems.length,
      zipCode: shippingAddress?.zipCode || null
    });

    const body = {
      amount: Math.round(amount),
      currency: 'BRL',
      paymentMethod: 'pix',
      postbackUrl,
      externalRef,
      metadata,
      ip,
      pix: {
        expiresInDays: 1
      },
      items: normalizedItems,
      customer: {
        name: normalizeString(customer.name),
        email: normalizeString(customer.email),
        phone: customerPhone,
        document: {
          number: customerCpf,
          type: 'cpf'
        },
        address: shippingAddress || undefined
      },
      shipping: requiresShipping ? {
        fee: 0,
        address: {
          street: shippingAddress.street,
          streetNumber: shippingAddress.streetNumber,
          neighborhood: shippingAddress.neighborhood,
          city: shippingAddress.city,
          state: shippingAddress.state,
          zipCode: shippingAddress.zipCode,
          country: shippingAddress.country,
          complement: shippingAddress.complement || undefined
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
          accept: 'application/json',
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

    const transactionKey = normalized.transactionId || externalRef;
    const customerName = normalizeString(customer.name);
    const itemTitle = normalizedItems[0]?.title || 'Pedido AquaGas';
    const amountValue = Math.round(Number(amount || 0)) / 100;
    const amountStr = `R$${amountValue.toFixed(2).replace('.', ',')}`;

    try {
      await trackMetricEvent({
        sessionId: transactionKey,
        eventName: 'Order_Generated',
        metadata: {
          transactionId: normalized.transactionId || null,
          externalRef,
          amount: amountValue,
          customerName,
          itemTitle,
          paymentMethod: 'pix',
          status: 'waiting_payment',
          description: `${customerName} • ${amountStr} • pedido gerado`
        }
      });
    } catch (trackingError) {
      console.warn('[Metrics] Falha ao registrar pedido gerado:', trackingError.message);
    }

    return res.status(200).json({
      ok: true,
      pixCode: normalized.pixCode,
      qrCodeImage: normalized.qrCodeImage,
      expirationDate: normalized.expirationDate,
      transactionId: transactionKey,
      pix: {
        qrcode: normalized.pixCode,
        qrCodeImage: normalized.qrCodeImage,
        expirationDate: normalized.expirationDate,
        transactionId: transactionKey
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
