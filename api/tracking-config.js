import {
  DEFAULT_TRACKING_CONFIG,
  getSetting,
  normalizeTrackingConfig
} from './_lib/settings.js';

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeGoogleTagId(value) {
  const tagId = normalizeString(value).toUpperCase();

  if (!tagId) {
    return '';
  }

  if (/^(AW|G)-/.test(tagId)) {
    return tagId;
  }

  if (/^\d+$/.test(tagId)) {
    return `AW-${tagId}`;
  }

  return tagId;
}

function buildPublicTrackingConfig(config) {
  const normalized = normalizeTrackingConfig(config);

  return {
    gtags: normalized.gtags
      .map((gtag) => ({
        id: normalizeGoogleTagId(gtag.id),
        label: normalizeString(gtag.label)
      }))
      .filter((gtag) => gtag.id),
    pixels: normalized.pixels
      .map((pixel) => ({
        id: normalizeString(pixel.id)
      }))
      .filter((pixel) => pixel.id)
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const config = await getSetting('tracking_config', DEFAULT_TRACKING_CONFIG);

    return res.status(200).json({
      config: buildPublicTrackingConfig(config)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
