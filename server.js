import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3210;

app.use(cors());
app.use(express.json());

// ─── Authentication ───
const ADMIN_USER = {
  email: 'saidlabsglobal@gmail.com',
  password: '530348Home10'
};
const SESSION_TOKEN = 'ligeirinho_admin_secret_token_2026';

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  
  if (email === ADMIN_USER.email && password === ADMIN_USER.password) {
    console.log('[Auth] Login bem-sucedido:', email);
    return res.json({ 
      ok: true, 
      token: SESSION_TOKEN,
      user: { email: ADMIN_USER.email }
    });
  }
  
  console.warn('[Auth] Tentativa de login falhou:', email);
  res.status(401).json({ ok: false, error: 'Credenciais inválidas' });
});

// ─── Keys storage (file-based for simplicity) ───
const KEYS_FILE = join(__dirname, '.api-keys.json');

function getKeys() {
  if (existsSync(KEYS_FILE)) {
    return JSON.parse(readFileSync(KEYS_FILE, 'utf8'));
  }
  return {};
}

function saveKeys(keys) {
  writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
}

// ─── Endpoint: Save API keys ───
app.post('/api/keys', (req, res) => {
  const { publicKey, secretKey } = req.body;
  if (!publicKey || !secretKey) {
    return res.status(400).json({ error: 'publicKey and secretKey are required' });
  }
  saveKeys({ publicKey, secretKey });
  res.json({ ok: true, message: 'Chaves salvas com sucesso' });
});

// ─── Endpoint: Check if keys are configured ───
app.get('/api/keys/status', (req, res) => {
  const keys = getKeys();
  res.json({ configured: !!(keys.publicKey && keys.secretKey) });
});

// ─── Endpoint: Create PIX charge via Titans Hub ───
app.post('/api/pix/create', async (req, res) => {
  const keys = getKeys();
  if (!keys.publicKey || !keys.secretKey) {
    return res.status(400).json({ error: 'API keys not configured. Set them in the admin panel.' });
  }

  const { amount, items, customer, shipping } = req.body;

  if (!amount || !customer) {
    return res.status(400).json({ error: 'amount and customer are required' });
  }

  // Build Titans Hub request
  const auth = Buffer.from(`${keys.publicKey}:${keys.secretKey}`).toString('base64');

  const body = {
    amount: Math.round(amount), // centavos
    paymentMethod: 'pix',
    postbackUrl: req.body.postbackUrl || `http://localhost:${PORT}/api/pix/webhook`,
    items: items || [{ title: 'Pedido Ligeirinho', unitPrice: Math.round(amount), quantity: 1, tangible: true }],
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

  try {
    const response = await fetch('https://api.titanshub.io/v1/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Titans Hub Error]', response.status, data);
      return res.status(response.status).json({ error: 'Payment API error', details: data });
    }

    console.log('[PIX Charge Created]', { id: data.data?.id, amount });
    res.json(data);
  } catch (err) {
    console.error('[Server Error]', err.message);
    res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

// ─── Config storage helpers ───
const CONFIG_FILE = join(__dirname, '.admin-config.json');

function getConfig() {
  if (existsSync(CONFIG_FILE)) return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  return { pixels: [], gtags: [], pushcuts: [] };
}
function saveConfig(updates) {
  const current = getConfig();
  writeFileSync(CONFIG_FILE, JSON.stringify({ ...current, ...updates }, null, 2));
}

// ─── Endpoint: Save Pixels (multi) ───
app.post('/api/pixel', (req, res) => {
  const { pixels } = req.body;
  saveConfig({ pixels: pixels || [] });
  console.log('[Pixels Config Updated]', pixels?.length);
  res.json({ ok: true });
});

// ─── Endpoint: Save Pushcuts (multi) ───
app.post('/api/pushcut', (req, res) => {
  const { pushcuts } = req.body;
  saveConfig({ pushcuts: pushcuts || [] });
  console.log('[Pushcuts Config Updated]', pushcuts?.length);
  res.json({ ok: true });
});

// ─── Endpoint: Save Gtags (multi) ───
app.post('/api/gtag', (req, res) => {
  const { gtags } = req.body;
  saveConfig({ gtags: gtags || [] });
  console.log('[Gtags Config Updated]', gtags?.length);
  res.json({ ok: true });
});

// ─── Endpoint: Webhook for payment status updates ───
app.post('/api/pix/webhook', async (req, res) => {
  const payload = req.body;
  console.log('[Webhook Received]', JSON.stringify(payload, null, 2));

  const status = payload?.status || payload?.data?.status;
  const isPaid = status === 'paid';

  if (isPaid) {
    const amount = (payload?.data?.amount || payload?.amount || 0) / 100;
    const customerName = payload?.data?.customer?.name || 'Cliente';
    const itemTitle = payload?.data?.items?.[0]?.title || 'Pedido';
    const amountStr = `R$${amount.toFixed(2).replace('.', ',')}`;

    console.log(`[💰 VENDA PAGA] ${customerName} — ${amountStr} — ${itemTitle}`);

    const config = getConfig();

    // 1. Process multiple Pushcut notifications
    const pushcuts = config.pushcuts || (config.pushcutUrl ? [{ url: config.pushcutUrl }] : []);
    for (const pc of pushcuts) {
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
        console.log(`[Pushcut] Notificação enviada: ${pc.url.substring(0, 30)}...`);
      } catch (err) {
        console.error('[Pushcut Error]', err.message);
      }
    }

    // 2. Process multiple Facebook Pixels (CAPI)
    const pixels = config.pixels || (config.pixelId ? [{ id: config.pixelId, token: config.pixelToken }] : []);
    for (const px of pixels) {
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

        const fbRes = await fetch(
          `https://graph.facebook.com/v18.0/${px.id}/events?access_token=${px.token}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(eventData)
          }
        );
        const fbData = await fbRes.json();
        console.log(`[Pixel CAPI] Evento enviado para ID ${px.id}:`, fbData);
      } catch (err) {
        console.error(`[Pixel Error] ID ${px.id}:`, err.message);
      }
    }
  }

  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Ligeirinho API Server running on http://localhost:${PORT}`);
  console.log(`   POST /api/pix/create    — Create PIX charge`);
  console.log(`   POST /api/pix/webhook   — Payment webhook (Titans Hub)`);
  console.log(`   POST /api/keys          — Save API keys`);
  console.log(`   POST /api/pixel         — Save Pixels`);
  console.log(`   POST /api/pushcut       — Save Pushcut URLs`);
  console.log(`   GET  /api/keys/status   — Check key status\n`);
});
