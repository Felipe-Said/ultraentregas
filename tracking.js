const API_URL = '/api';
const SESSION_STORAGE_KEY = 'aquagas_session_id';
const HEARTBEAT_INTERVAL_MS = 30000;

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

document.addEventListener('DOMContentLoaded', () => {
  sendMetric('PageView');
  startPresenceTracking();

  window.addEventListener('track-event', (e) => {
    sendMetric(e.detail.event, e.detail);
  });
});
