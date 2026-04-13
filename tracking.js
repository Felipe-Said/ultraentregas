const API_URL = 'http://localhost:5000/api'; // Substitua pelo seu backend real
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
    console.log(`[Tracking] ${eventName} registrado com sucesso.`);
  } catch (err) {
    console.warn(`[Tracking Simulator] ${eventName} detectado, mas não enviado. API mockada ou offline. Métrica seria:`, payload);
  }
}
