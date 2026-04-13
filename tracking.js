const API_URL = '/api'; // Using relative path for production
const session_id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();

document.addEventListener('DOMContentLoaded', () => {
  console.log("Tracking inicializado!");

  // Track initial page view
  sendMetric('PageView', { path: window.location.pathname });

  // Listen for custom events dispatched by main.js
  window.addEventListener('track-event', (e) => {
    sendMetric(e.detail.event, e.detail);
  });
});

async function sendMetric(eventName, data) {
  const payload = {
    session_id,
    event: eventName,
    data,
    timestamp: new Date().toISOString()
  };

  try {
    const res = await fetch(`${API_URL}/track`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if(!res.ok) throw new Error('Falha ao registrar métrica');
    console.log(`[Tracking] ${eventName} registrado.`);
  } catch (err) {
    console.warn(`[Tracking] ${eventName} detectado, falha ao enviar:`, err.message);
  }
}
