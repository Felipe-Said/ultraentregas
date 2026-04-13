import { createAdminToken, getAdminCredentials } from './_lib/admin-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body || {};

  try {
    const adminUser = await getAdminCredentials();

    if (email === adminUser.email && password === adminUser.password) {
      return res.status(200).json({
        ok: true,
        token: createAdminToken(adminUser.email),
        user: { email: adminUser.email }
      });
    }

    return res.status(401).json({ ok: false, error: 'Credenciais invalidas' });
  } catch (error) {
    return res.status(503).json({ ok: false, error: error.message });
  }
}
