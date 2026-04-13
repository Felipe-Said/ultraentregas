import { getSupabase } from './supabase.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT_DIR = fileURLToPath(new URL('../../', import.meta.url));
const LOCAL_SETTINGS_FILES = {
  api_keys: path.join(ROOT_DIR, '.api-keys.json'),
  tracking_config: path.join(ROOT_DIR, '.admin-config.json')
};

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

async function readLocalSetting(id) {
  const filePath = LOCAL_SETTINGS_FILES[id];

  if (!filePath) {
    return undefined;
  }

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

async function writeLocalSetting(id, data) {
  const filePath = LOCAL_SETTINGS_FILES[id];

  if (!filePath) {
    return false;
  }

  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return true;
}

export async function getSetting(id, fallbackValue) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('settings')
      .select('data')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (data?.data !== undefined && data?.data !== null) {
      return data.data;
    }
  } catch (error) {
    const localSetting = await readLocalSetting(id);

    if (localSetting !== undefined) {
      return localSetting;
    }

    if (fallbackValue !== undefined) {
      return fallbackValue;
    }

    throw error;
  }

  const localSetting = await readLocalSetting(id);
  return localSetting ?? fallbackValue;
}

export async function upsertSetting(id, data) {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('settings')
      .upsert({ id, data }, { onConflict: 'id' });

    if (error) {
      throw error;
    }

    await writeLocalSetting(id, data).catch(() => false);
  } catch (error) {
    const wroteLocal = await writeLocalSetting(id, data).catch(() => false);

    if (wroteLocal) {
      return;
    }

    throw error;
  }
}
