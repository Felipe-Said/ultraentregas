import { supabase } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 1. Fetch API keys from Supabase
  let keys = {};
  try {
    const { data: keyRecord } = await supabase
      .from('settings')
      .select('data')
      .eq('id', 'api_keys')
      .single();
    
    if (keyRecord?.data?.publicKey) {
      keys = keyRecord.data;
    }
  } catch (e) {
    console.warn('[PIX] Supabase fetch failed or missing config. Falling back to local keys.');
  }

  // Fallback to local keys if Supabase fails or is not configured on Vercel yet
  if (!keys.publicKey || !keys.secretKey) {
    keys = {
      publicKey: "pk_OCkO8rkkmTMRnY4CKq0cf7RV_Q4C37dUXvyAaLwh1IB5vRHD",
      secretKey: "sk_VUbRlurQwg6x6rTdcC3YkYCDKiuG4wBr7XMJvfwuFvAnmh_W"
    };
  }

  if (!keys.publicKey || !keys.secretKey) {
    return res.status(400).json({ error: 'API keys not configured.' });
  }

  const { amount, items, customer, shipping } = req.body;

  // 2. Build Titans Hub request
  const auth = Buffer.from(`${keys.publicKey}:${keys.secretKey}`).toString('base64');
  
  // Dynamic Webhook URL (Production)
  // Vercel apps should use their own domain. 
  // For the first deploy, we'll try to guess it from headers or just use relative path if we could, 
  // but Titans Hub needs an absolute URL.
  const host = req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const postbackUrl = `${protocol}://${host}/api/pix/webhook`;

  const body = {
    amount: Math.round(amount),
    paymentMethod: 'pix',
    postbackUrl: postbackUrl,
    items: items || [{ title: 'Pedido AquaGás', unitPrice: Math.round(amount), quantity: 1, tangible: true }],
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
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Titans Hub connection error', details: err.message });
  }
}
