import crypto from 'crypto';

import { getSetting } from './settings.js';

const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const LEGACY_ADMIN_CREDENTIALS = {
  email: 'saidlabsglobal@gmail.com',
  password: '530348Home10'
};

function getSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function encode(data) {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

function decode(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function sign(value) {
  return crypto
    .createHmac('sha256', getSecret())
    .update(value)
    .digest('base64url');
}

export async function getAdminCredentials() {
  try {
    const configuredAdmin = await getSetting('admin_auth', null);
    const email = configuredAdmin?.email?.trim?.() || '';
    const password = configuredAdmin?.password || '';
    const usingPlaceholder =
      email === 'admin@seuprojeto.com' && password === 'troque-esta-senha';

    if (email && password && !usingPlaceholder) {
      return { email, password };
    }
  } catch (error) {
    console.warn('[Admin Auth] Falling back to legacy credentials:', error.message);
  }

  return LEGACY_ADMIN_CREDENTIALS;
}

export function createAdminToken(email) {
  const payload = {
    email,
    exp: Date.now() + SESSION_TTL_MS
  };
  const encodedPayload = encode(payload);
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyAdminToken(token) {
  if (!token || !token.includes('.')) {
    throw new Error('Missing admin token');
  }

  const [encodedPayload, signature] = token.split('.');
  const expectedSignature = sign(encodedPayload);

  if (signature !== expectedSignature) {
    throw new Error('Invalid admin token');
  }

  const payload = decode(encodedPayload);
  if (!payload?.email || !payload?.exp || payload.exp < Date.now()) {
    throw new Error('Expired admin token');
  }

  return payload;
}

export function getBearerToken(req) {
  const header = req.headers.authorization || '';
  const [type, token] = header.split(' ');
  if (type !== 'Bearer' || !token) {
    throw new Error('Missing bearer token');
  }
  return token;
}

export function requireAdmin(req) {
  const token = getBearerToken(req);
  return verifyAdminToken(token);
}
