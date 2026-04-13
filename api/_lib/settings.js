import { getSupabase } from './supabase.js';

export const DEFAULT_TRACKING_CONFIG = {
  pixels: [],
  gtags: [],
  pushcuts: []
};

export const DEFAULT_API_KEYS = {
  publicKey: '',
  secretKey: ''
};

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeTrackingConfig(config = {}) {
  const pixels = Array.isArray(config.pixels)
    ? config.pixels
        .map((pixel) => ({
          id: normalizeString(pixel?.id),
          token: normalizeString(pixel?.token)
        }))
        .filter((pixel) => pixel.id || pixel.token)
    : [];

  const gtags = Array.isArray(config.gtags)
    ? config.gtags
        .map((gtag) => ({
          id: normalizeString(gtag?.id),
          label: normalizeString(gtag?.label)
        }))
        .filter((gtag) => gtag.id || gtag.label)
    : [];

  const pushcuts = Array.isArray(config.pushcuts)
    ? config.pushcuts
        .map((pushcut) => ({
          url: normalizeString(pushcut?.url)
        }))
        .filter((pushcut) => pushcut.url)
    : [];

  return { pixels, gtags, pushcuts };
}

export function normalizeApiKeys(keys = {}) {
  return {
    publicKey: normalizeString(keys.publicKey),
    secretKey: normalizeString(keys.secretKey)
  };
}

export async function getSetting(id, fallbackValue) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('settings')
    .select('data')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.data ?? fallbackValue;
}

export async function upsertSetting(id, data) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('settings')
    .upsert({ id, data }, { onConflict: 'id' });

  if (error) {
    throw error;
  }
}
