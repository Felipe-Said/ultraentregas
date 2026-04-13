const ADMIN_USER = {
  email: 'saidlabsglobal@gmail.com',
  password: '530348Home10'
};
const SESSION_TOKEN = 'aquagas_admin_secret_token_2026';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;

  if (email === ADMIN_USER.email && password === ADMIN_USER.password) {
    return res.status(200).json({
      ok: true,
      token: SESSION_TOKEN,
      user: { email: ADMIN_USER.email }
    });
  }

  return res.status(401).json({ ok: false, error: 'Credenciais inválidas' });
}
