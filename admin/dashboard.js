const API_URL = '/api'; // Using relative paths for Vercel Serverless

// State management
let fbPixels = [];
let gtags = [];
let pushcuts = [];

document.addEventListener('DOMContentLoaded', () => {
  loadDashboardData();
  initApiKeys();
  initPixel();
  initGtag();
  initPushcut();
});

// ═══════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════
async function loadDashboardData() {
  try {
    const res = await fetch(`${API_URL}/metrics`);
    if (!res.ok) throw new Error('API offline');
    const data = await res.json();
    renderDashboard(data);
  } catch (err) {
    console.error("[Admin] Erro ao carregar métricas:", err.message);
    renderDashboard({ views: 0, whatsappClicks: 0, cepFills: 0, totalSales: 0, logs: [] });
  }
}

function renderDashboard(data) {
  document.getElementById('metric-views').innerText = data.views || 0;
  document.getElementById('metric-leads').innerText = data.whatsappClicks || 0;
  document.getElementById('metric-cep').innerText = data.cepFills || 0;
  document.getElementById('metric-sales').innerText = data.totalSales || 0;

  const tbody = document.getElementById('logs-table');
  if (data.logs?.length > 0) {
    tbody.innerHTML = data.logs.map(log => `
      <tr style="border-bottom: 1px solid hsl(220 15% 95%); transition: background 0.15s;" onmouseenter="this.style.background='hsl(220 15% 98%)'" onmouseleave="this.style.background='transparent'">
        <td style="padding: 0.75rem 1rem; font-weight: 500;">${log.time}</td>
        <td style="padding: 0.75rem 1rem;">
          <span style="background: ${getEventColor(log.event)}; padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.6875rem; font-weight: 600;">
            ${log.event}
          </span>
        </td>
        <td style="padding: 0.75rem 1rem; color: hsl(220 15% 45%);">${log.desc}</td>
        <td style="padding: 0.75rem 1rem; font-family: monospace; font-size: 0.6875rem; color: hsl(220 15% 60%);">${log.user}</td>
      </tr>
    `).join('');
  } else {
    tbody.innerHTML = '<tr><td colspan="4" style="padding: 2rem; text-align: center; color: hsl(220 10% 60%); font-size: 0.75rem;">Nenhuma atividade recente</td></tr>';
  }
}

function getEventColor(event) {
  const colors = {
    'Purchase': 'hsl(152 70% 42% / 0.1); color: hsl(152 70% 38%)',
    'Checkout_Click': 'hsl(213 90% 55% / 0.1); color: hsl(213 90% 55%)',
    'PageView': 'hsl(220 15% 90% / 0.5); color: hsl(220 15% 40%)',
  };
  return colors[event] || 'hsl(220 15% 90%); color: hsl(220 15% 50%)';
}

// ═══════════════════════════════════════════
// API KEYS
// ═══════════════════════════════════════════
async function initApiKeys() {
  const publicInput = document.getElementById('inp-public-key');
  const secretInput = document.getElementById('inp-secret-key');
  const saveBtn = document.getElementById('btn-save-keys');
  const feedback = document.getElementById('api-save-feedback');

  try {
    const res = await fetch(`${API_URL}/settings`);
    const data = await res.json();
    if (data.keys) {
      publicInput.value = data.keys.publicKey || '';
      secretInput.value = data.keys.secretKey || '';
    }
  } catch (err) { console.warn('[Admin] Erro ao buscar chaves:', err); }

  saveBtn.addEventListener('click', async () => {
    const payload = { publicKey: publicInput.value.trim(), secretKey: secretInput.value.trim() };
    try {
      await fetch(`${API_URL}/settings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'keys', payload })
      });
      showFeedback(feedback, 'Chaves salvas!', false);
    } catch { showFeedback(feedback, 'Erro ao salvar', true); }
  });
}

// ═══════════════════════════════════════════
// SETTINGS (MULTI)
// ═══════════════════════════════════════════
async function initPixel() {
  await loadSettings();
  renderPixelList();
  renderGtagList();
  renderPushcutList();
}

async function loadSettings() {
  try {
    const res = await fetch(`${API_URL}/settings`);
    const data = await res.json();
    fbPixels = data.config.pixels || [];
    gtags = data.config.gtags || [];
    pushcuts = data.config.pushcuts || [];
  } catch (err) { console.warn('[Admin] Erro ao carregar configurações:', err); }
}

async function saveSettings(feedbackEl) {
  const payload = { pixels: fbPixels, gtags, pushcuts };
  try {
    await fetch(`${API_URL}/settings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'config', payload })
    });
    showFeedback(feedbackEl, 'Configurações salvas!', false);
  } catch { showFeedback(feedbackEl, 'Erro ao salvar', true); }
}

// FB PIXELS
window.addPixelRow = () => { fbPixels.push({ id: '', token: '' }); renderPixelList(); };
window.removePixelRow = (i) => { fbPixels.splice(i, 1); renderPixelList(); };
function renderPixelList() {
  const listContainer = document.getElementById('fb-pixels-list');
  if (fbPixels.length === 0) {
    listContainer.innerHTML = `<div style="padding: 2rem; border: 1.5px dashed hsl(220 15% 90%); border-radius: 1rem; text-align: center; color: hsl(220 10% 60%); font-size: 0.75rem;">Nenhum Pixel configurado</div>`;
  } else {
    listContainer.innerHTML = fbPixels.map((p, i) => `
      <div class="pixel-row admin-card" style="padding: 1.25rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 0.75rem; align-items: flex-end;">
          <div><label class="admin-label">Pixel ID</label><input type="text" onchange="fbPixels[${i}].id=this.value" class="admin-input mono" value="${p.id}" /></div>
          <div><label class="admin-label">Token (CAPI)</label><input type="password" onchange="fbPixels[${i}].token=this.value" class="admin-input mono" value="${p.token}" /></div>
          <button onclick="removePixelRow(${i})" class="admin-btn admin-btn-outline" style="color: #ef4444;"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </div>
      </div>
    `).join('');
  }
  lucide.createIcons();
}
document.getElementById('btn-save-pixels')?.addEventListener('click', () => saveSettings(document.getElementById('pixel-save-feedback')));

// GTAGS
window.addGtagRow = () => { gtags.push({ id: '', label: '' }); renderGtagList(); };
window.removeGtagRow = (i) => { gtags.splice(i, 1); renderGtagList(); };
function renderGtagList() {
  const listContainer = document.getElementById('gtag-list');
  if (gtags.length === 0) {
    listContainer.innerHTML = `<div style="padding: 2rem; border: 1.5px dashed rgba(66,133,244,.2); border-radius: 1rem; text-align: center; color: hsl(220 10% 60%); font-size: 0.75rem;">Nenhuma Tag configurada</div>`;
  } else {
    listContainer.innerHTML = gtags.map((g, i) => `
      <div class="gtag-row admin-card" style="padding: 1.25rem; border-color: rgba(66,133,244,.15);">
        <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 0.75rem; align-items: flex-end;">
          <div><label class="admin-label">Google Tag ID</label><input type="text" onchange="gtags[${i}].id=this.value" class="admin-input mono" value="${g.id}" /></div>
          <div><label class="admin-label">Label</label><input type="text" onchange="gtags[${i}].label=this.value" class="admin-input mono" value="${g.label}" /></div>
          <button onclick="removeGtagRow(${i})" class="admin-btn admin-btn-outline" style="color: #ef4444;"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </div>
      </div>
    `).join('');
  }
  lucide.createIcons();
}
document.getElementById('btn-save-gtags')?.addEventListener('click', () => saveSettings(document.getElementById('gtag-save-feedback')));

// PUSHCUTS
window.addPushcutRow = () => { pushcuts.push({ url: '' }); renderPushcutList(); };
window.removePushcutRow = (i) => { pushcuts.splice(i, 1); renderPushcutList(); };
function renderPushcutList() {
  const listContainer = document.getElementById('pushcut-list');
  if (pushcuts.length === 0) {
    listContainer.innerHTML = `<div style="padding: 2rem; border: 1.5px dashed hsl(280 70% 55% / 0.2); border-radius: 1rem; text-align: center; color: hsl(220 10% 60%); font-size: 0.75rem;">Nenhum Webhook configurado</div>`;
  } else {
    listContainer.innerHTML = pushcuts.map((p, i) => `
      <div class="pushcut-row admin-card" style="padding: 1.25rem;">
        <div style="display: flex; gap: 0.75rem; align-items: center;">
          <div style="flex: 1;"><label class="admin-label">Webhook URL</label><input type="url" onchange="pushcuts[${i}].url=this.value" class="admin-input mono" value="${p.url}" /></div>
          <button onclick="removePushcutRow(${i})" class="admin-btn admin-btn-outline" style="color: #ef4444; margin-top: 1.2rem;"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </div>
      </div>
    `).join('');
  }
  lucide.createIcons();
}
document.getElementById('btn-save-pushcuts')?.addEventListener('click', () => saveSettings(document.getElementById('pushcut-save-feedback')));

// HELPERS
function showFeedback(el, text, isError) {
  const icon = isError ? '<i data-lucide="alert-circle" class="w-4 h-4"></i>' : '<i data-lucide="check" class="w-4 h-4"></i>';
  el.innerHTML = `${icon} <span>${text}</span>`;
  el.style.display = 'flex';
  el.style.alignItems = 'center';
  el.style.gap = '0.5rem';
  el.style.color = isError ? '#ef4444' : '#10b981';
  el.style.opacity = '1';
  lucide.createIcons();
  setTimeout(() => el.style.opacity = '0', 3000);
}

window.logout = () => { localStorage.removeItem('aquagas_admin_token'); window.location.href = 'login.html'; };

function initGtag() {} // Legacy holder
function initPushcut() {} // Legacy holder
