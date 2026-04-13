const API_URL = '/api';
const SESSION_STORAGE_KEY = 'aquagas_session_id';
const HEARTBEAT_INTERVAL_MS = 30000;
const TRACKING_CONFIG_URL = `${API_URL}/tracking-config`;
const PURCHASE_TRACKED_PREFIX = 'aquagas_purchase_tracked_';

let trackingConfigPromise = null;
let googleTagReadyPromise = null;

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

function createSessionId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getSessionId() {
  const existingSessionId = window.sessionStorage.getItem(SESSION_STORAGE_KEY);

  if (existingSessionId) {
    return existingSessionId;
  }

  const newSessionId = createSessionId();
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, newSessionId);
  return newSessionId;
}

const session_id = getSessionId();

function buildPayload(eventName, data = {}) {
  return {
    session_id,
    event: eventName,
    data: {
      path: window.location.pathname,
      title: document.title,
      ...data
    },
    timestamp: new Date().toISOString()
  };
}

async function sendMetric(eventName, data = {}) {
  try {
    const res = await fetch(`${API_URL}/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(buildPayload(eventName, data))
    });

    if (!res.ok) {
      throw new Error('Falha ao registrar metrica');
    }
  } catch (err) {
    console.warn(`[Tracking] ${eventName} detectado, falha ao enviar:`, err.message);
  }
}

function startPresenceTracking() {
  const sendHeartbeat = () => {
    if (document.visibilityState !== 'visible') {
      return;
    }

    sendMetric('Heartbeat');
  };

  sendHeartbeat();

  const heartbeatInterval = window.setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      sendHeartbeat();
    }
  });

  window.addEventListener('pagehide', () => {
    window.clearInterval(heartbeatInterval);
  }, { once: true });
}

async function loadTrackingConfig() {
  if (!trackingConfigPromise) {
    trackingConfigPromise = fetch(TRACKING_CONFIG_URL)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Falha ao carregar configuracao publica de tracking');
        }

        const payload = await response.json();
        const config = payload?.config || {};
        const gtags = Array.isArray(config.gtags)
          ? config.gtags
              .map((gtag) => ({
                id: normalizeGoogleTagId(gtag?.id),
                label: normalizeString(gtag?.label)
              }))
              .filter((gtag) => gtag.id)
          : [];

        return { gtags };
      })
      .catch((error) => {
        console.warn('[Tracking] Falha ao carregar tags publicas:', error.message);
        return { gtags: [] };
      });
  }

  return trackingConfigPromise;
}

function createGtagQueue() {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };
}

function loadGoogleTagScript(primaryTagId) {
  const existingScript = document.querySelector('script[data-google-tag-loader="true"]');

  if (existingScript) {
    if (existingScript.dataset.loaded === 'true') {
      return Promise.resolve();
    }

    if (existingScript.dataset.failed === 'true') {
      return Promise.reject(new Error('Google tag script indisponivel'));
    }

    return new Promise((resolve, reject) => {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Google tag script indisponivel')), { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const googleTagScript = document.createElement('script');
    googleTagScript.async = true;
    googleTagScript.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(primaryTagId)}`;
    googleTagScript.dataset.googleTagLoader = 'true';
    googleTagScript.addEventListener('load', () => {
      googleTagScript.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    googleTagScript.addEventListener('error', () => {
      googleTagScript.dataset.failed = 'true';
      reject(new Error('Google tag script indisponivel'));
    }, { once: true });
    document.head.appendChild(googleTagScript);
  });
}

async function ensureGoogleTagsReady() {
  if (!googleTagReadyPromise) {
    googleTagReadyPromise = loadTrackingConfig().then(async ({ gtags }) => {
      const uniqueTagIds = [...new Set(gtags.map((gtag) => gtag.id).filter(Boolean))];

      if (uniqueTagIds.length === 0) {
        return [];
      }

      createGtagQueue();
      await loadGoogleTagScript(uniqueTagIds[0]);

      window.gtag('js', new Date());
      uniqueTagIds.forEach((tagId) => {
        window.gtag('config', tagId);
      });

      return gtags;
    }).catch((error) => {
      console.warn('[Tracking] Falha ao inicializar Google Tags:', error.message);
      return [];
    });
  }

  return googleTagReadyPromise;
}

function hasTrackedPurchase(transactionId) {
  return Boolean(window.localStorage.getItem(`${PURCHASE_TRACKED_PREFIX}${transactionId}`));
}

function markPurchaseTracked(transactionId) {
  window.localStorage.setItem(`${PURCHASE_TRACKED_PREFIX}${transactionId}`, new Date().toISOString());
}

async function firePaidConversions({ transactionId, value, currency = 'BRL' }) {
  const normalizedTransactionId = normalizeString(transactionId);

  if (!normalizedTransactionId || hasTrackedPurchase(normalizedTransactionId)) {
    return {
      fired: false,
      reason: normalizedTransactionId ? 'already_tracked' : 'missing_transaction_id'
    };
  }

  const gtags = await ensureGoogleTagsReady();
  const conversionTargets = gtags
    .filter((gtag) => gtag.label)
    .map((gtag) => `${gtag.id}/${gtag.label}`);

  if (conversionTargets.length === 0) {
    return { fired: false, reason: 'no_google_conversions_configured' };
  }

  conversionTargets.forEach((sendTo) => {
    window.gtag('event', 'conversion', {
      send_to: sendTo,
      value,
      currency,
      transaction_id: normalizedTransactionId
    });
  });

  markPurchaseTracked(normalizedTransactionId);
  await sendMetric('Browser_Purchase_Confirmed', {
    transactionId: normalizedTransactionId,
    value,
    currency,
    targets: conversionTargets
  });

  return {
    fired: true,
    targets: conversionTargets
  };
}

window.aquagasTracking = {
  ensureGoogleTagsReady,
  firePaidConversions,
  loadTrackingConfig,
  sessionId: session_id
};

document.addEventListener('DOMContentLoaded', () => {
  sendMetric('PageView');
  startPresenceTracking();
  ensureGoogleTagsReady();

  window.addEventListener('track-event', (e) => {
    sendMetric(e.detail.event, e.detail);
  });
});
