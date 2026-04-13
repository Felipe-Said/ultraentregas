const API_URL = '/api';
const DASHBOARD_REFRESH_MS = 15000;

let fbPixels = [];
let gtags = [];
let pushcuts = [];
let dashboardRefreshTimer = null;

function updateApiStatusBadges(keys = {}) {
  const hasKeys = Boolean(keys.publicKey && keys.secretKey);
  const topBadge = document.getElementById('api-status-badge');
  const navBadge = document.getElementById('nav-api-badge');

  if (topBadge) {
    topBadge.textContent = hasKeys ? 'Chaves OK' : 'Sem chaves';
    topBadge.className = `admin-badge ${hasKeys ? 'admin-badge-active' : 'admin-badge-inactive'}`;
  }

  if (navBadge) {
    navBadge.textContent = hasKeys ? 'OK' : '-';
    navBadge.className = `admin-badge ${hasKeys ? 'admin-badge-active' : 'admin-badge-inactive'}`;
  }
}

function getAuthHeaders() {
  const token = localStorage.getItem('aquagas_admin_token');
  return token
    ? {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    : { 'Content-Type': 'application/json' };
}

function handleUnauthorized(errorMessage) {
  if (/token/i.test(errorMessage || '')) {
    localStorage.removeItem('aquagas_admin_token');
    localStorage.removeItem('aquagas_admin_user');
    window.location.href = 'login.html';
    return true;
  }

  return false;
}

function getLocalDateInputValue() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function getSelectedMetricsDate() {
  const input = document.getElementById('metrics-date');
  return input?.value || getLocalDateInputValue();
}

function updateMetricsDateCaption(data = {}) {
  const caption = document.getElementById('metrics-date-caption');

  if (!caption) {
    return;
  }

  const selectedDate = data.selectedDate || getSelectedMetricsDate();
  const activeWindowMinutes = data.activeWindowMinutes || 2;
  const minuteLabel = activeWindowMinutes === 1 ? 'minuto' : 'minutos';

  caption.textContent = `Vendas Pagas e Pedidos Gerados mostram ${selectedDate}. Visitantes e Acesso checkout consideram os ultimos ${activeWindowMinutes} ${minuteLabel}.`;
}

function initDashboardFilters() {
  const dateInput = document.getElementById('metrics-date');
  const todayButton = document.getElementById('metrics-date-today');

  if (dateInput) {
    dateInput.value = getLocalDateInputValue();
    dateInput.addEventListener('change', () => loadDashboardData());
  }

  todayButton?.addEventListener('click', () => {
    if (dateInput) {
      dateInput.value = getLocalDateInputValue();
    }

    loadDashboardData();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initDashboardFilters();
  loadDashboardData();

  if (!dashboardRefreshTimer) {
    dashboardRefreshTimer = window.setInterval(() => {
      const dashboardSection = document.getElementById('section-dashboard');

      if (dashboardSection?.classList.contains('active')) {
        loadDashboardData(true);
      }
    }, DASHBOARD_REFRESH_MS);
  }

  initApiKeys();
  initPixel();
  initGtag();
  initPushcut();
});

async function loadDashboardData(isSilentRefresh = false) {
  try {
    const selectedDate = getSelectedMetricsDate();
    const res = await fetch(`${API_URL}/metrics?date=${encodeURIComponent(selectedDate)}`, {
      headers: getAuthHeaders()
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload.error || 'API offline');
    }

    const data = await res.json();
    renderDashboard(data);
  } catch (err) {
    console.error('[Admin] Erro ao carregar metricas:', err.message);

    if (handleUnauthorized(err.message)) {
      return;
    }

    if (!isSilentRefresh) {
      renderDashboard({
        error: err.message,
        logs: [],
        selectedDate: getSelectedMetricsDate()
      });
    }
  }
}

function renderDashboard(data) {
  document.getElementById('metric-views').innerText = data.activeVisitors ?? '--';
  document.getElementById('metric-leads').innerText = data.paidSales ?? '--';
  document.getElementById('metric-cr').innerText = data.generatedOrders ?? '--';
  document.getElementById('metric-cep').innerText = data.activeCheckoutVisitors ?? '--';
  updateMetricsDateCaption(data);

  const tbody = document.getElementById('logs-table');

  if (data.error) {
    tbody.innerHTML = `<tr><td colspan="4" style="padding: 2rem; text-align: center; color: #ef4444; font-size: 0.75rem;">Falha ao carregar metricas reais: ${data.error}</td></tr>`;
    return;
  }

  if (data.logs?.length > 0) {
    tbody.innerHTML = data.logs.map((log) => `
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
    return;
  }

  tbody.innerHTML = '<tr><td colspan="4" style="padding: 2rem; text-align: center; color: hsl(220 10% 60%); font-size: 0.75rem;">Nenhuma atividade real registrada ainda</td></tr>';
}

function getEventColor(event) {
  const colors = {
    Purchase: 'hsl(152 70% 42% / 0.1); color: hsl(152 70% 38%)',
    Order_Generated: 'hsl(38 95% 55% / 0.12); color: hsl(38 95% 45%)',
    Checkout_Click: 'hsl(213 90% 55% / 0.1); color: hsl(213 90% 55%)',
    CEP_Filled: 'hsl(250 80% 55% / 0.1); color: hsl(250 80% 55%)',
    PageView: 'hsl(220 15% 90% / 0.5); color: hsl(220 15% 40%)'
  };

  return colors[event] || 'hsl(220 15% 90%); color: hsl(220 15% 50%)';
}

async function initApiKeys() {
  const publicInput = document.getElementById('inp-public-key');
  const secretInput = document.getElementById('inp-secret-key');
  const saveBtn = document.getElementById('btn-save-keys');
  const feedback = document.getElementById('api-save-feedback');

  try {
    const res = await fetch(`${API_URL}/settings`, {
      headers: getAuthHeaders()
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload.error || 'Erro ao buscar chaves');
    }

    const data = await res.json();

    if (data.keys) {
      publicInput.value = data.keys.publicKey || '';
      secretInput.value = data.keys.secretKey || '';
    }

    updateApiStatusBadges(data.keys || {});
  } catch (err) {
    if (handleUnauthorized(err.message)) {
      return;
    }

    console.warn('[Admin] Erro ao buscar chaves:', err);
    updateApiStatusBadges({});
  }

  saveBtn.addEventListener('click', async () => {
    const payload = {
      publicKey: publicInput.value.trim(),
      secretKey: secretInput.value.trim()
    };

    try {
      const res = await fetch(`${API_URL}/settings`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ type: 'keys', payload })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao salvar chaves');
      }

      updateApiStatusBadges(payload);
      showFeedback(feedback, 'Chaves salvas!', false);
    } catch (err) {
      if (handleUnauthorized(err.message)) {
        return;
      }

      showFeedback(feedback, err.message || 'Erro ao salvar', true);
    }
  });
}

async function initPixel() {
  await loadSettings();
  renderPixelList();
  renderGtagList();
  renderPushcutList();
}

async function loadSettings() {
  try {
    const res = await fetch(`${API_URL}/settings`, {
      headers: getAuthHeaders()
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload.error || 'Erro ao carregar configuracoes');
    }

    const data = await res.json();
    fbPixels = data.config.pixels || [];
    gtags = data.config.gtags || [];
    pushcuts = data.config.pushcuts || [];
  } catch (err) {
    if (handleUnauthorized(err.message)) {
      return;
    }

    console.warn('[Admin] Erro ao carregar configuracoes:', err);
  }
}

async function saveSettings(feedbackEl) {
  const payload = { pixels: fbPixels, gtags, pushcuts };

  try {
    const res = await fetch(`${API_URL}/settings`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ type: 'config', payload })
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Erro ao salvar configuracoes');
    }

    showFeedback(feedbackEl, 'Configuracoes salvas!', false);
  } catch (err) {
    if (handleUnauthorized(err.message)) {
      return;
    }

    showFeedback(feedbackEl, err.message || 'Erro ao salvar', true);
  }
}

async function sendPushcutTest(index, button) {
  const pushcut = pushcuts[index];
  const feedbackEl = document.getElementById('pushcut-save-feedback');
  const url = typeof pushcut?.url === 'string' ? pushcut.url.trim() : '';

  if (!url) {
    showFeedback(feedbackEl, 'Informe a URL antes de testar', true);
    return;
  }

  const originalHtml = button?.innerHTML || '';

  try {
    if (button) {
      button.disabled = true;
      button.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Testando';
      lucide.createIcons();
    }

    const res = await fetch(`${API_URL}/pushcut/test`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ url })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || 'Erro ao enviar teste');
    }

    showFeedback(feedbackEl, data.message || 'Teste enviado com sucesso!', false);
  } catch (err) {
    if (handleUnauthorized(err.message)) {
      return;
    }

    showFeedback(feedbackEl, err.message || 'Erro ao testar webhook', true);
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = originalHtml;
      lucide.createIcons();
    }
  }
}

window.addPixelRow = () => {
  fbPixels.push({ id: '', token: '' });
  renderPixelList();
};

window.removePixelRow = (index) => {
  fbPixels.splice(index, 1);
  renderPixelList();
};

function renderPixelList() {
  const listContainer = document.getElementById('fb-pixels-list');

  if (fbPixels.length === 0) {
    listContainer.innerHTML = '<div style="padding: 2rem; border: 1.5px dashed hsl(220 15% 90%); border-radius: 1rem; text-align: center; color: hsl(220 10% 60%); font-size: 0.75rem;">Nenhum Pixel configurado</div>';
  } else {
    listContainer.innerHTML = fbPixels.map((pixel, index) => `
      <div class="pixel-row admin-card" style="padding: 1.25rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 0.75rem; align-items: flex-end;">
          <div><label class="admin-label">Pixel ID</label><input type="text" oninput="fbPixels[${index}].id=this.value" class="admin-input mono" value="${pixel.id}" /></div>
          <div><label class="admin-label">Token (CAPI)</label><input type="password" oninput="fbPixels[${index}].token=this.value" class="admin-input mono" value="${pixel.token}" /></div>
          <button onclick="removePixelRow(${index})" class="admin-btn admin-btn-outline" style="color: #ef4444;"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </div>
      </div>
    `).join('');
  }

  lucide.createIcons();
}

document.getElementById('btn-save-pixels')?.addEventListener('click', () => {
  saveSettings(document.getElementById('pixel-save-feedback'));
});

window.addGtagRow = () => {
  gtags.push({ id: '', label: '' });
  renderGtagList();
};

window.removeGtagRow = (index) => {
  gtags.splice(index, 1);
  renderGtagList();
};

function renderGtagList() {
  const listContainer = document.getElementById('gtag-list');

  if (gtags.length === 0) {
    listContainer.innerHTML = '<div style="padding: 2rem; border: 1.5px dashed rgba(66,133,244,.2); border-radius: 1rem; text-align: center; color: hsl(220 10% 60%); font-size: 0.75rem;">Nenhuma Tag configurada</div>';
  } else {
    listContainer.innerHTML = gtags.map((gtag, index) => `
      <div class="gtag-row admin-card" style="padding: 1.25rem; border-color: rgba(66,133,244,.15);">
        <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 0.75rem; align-items: flex-end;">
          <div><label class="admin-label">Google Tag ID</label><input type="text" oninput="gtags[${index}].id=this.value" class="admin-input mono" value="${gtag.id}" /></div>
          <div><label class="admin-label">Label</label><input type="text" oninput="gtags[${index}].label=this.value" class="admin-input mono" value="${gtag.label}" /></div>
          <button onclick="removeGtagRow(${index})" class="admin-btn admin-btn-outline" style="color: #ef4444;"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </div>
      </div>
    `).join('');
  }

  lucide.createIcons();
}

document.getElementById('btn-save-gtags')?.addEventListener('click', () => {
  saveSettings(document.getElementById('gtag-save-feedback'));
});

window.addPushcutRow = () => {
  pushcuts.push({ url: '' });
  renderPushcutList();
};

window.removePushcutRow = (index) => {
  pushcuts.splice(index, 1);
  renderPushcutList();
};

function renderPushcutList() {
  const listContainer = document.getElementById('pushcut-list');

  if (pushcuts.length === 0) {
    listContainer.innerHTML = '<div style="padding: 2rem; border: 1.5px dashed hsl(280 70% 55% / 0.2); border-radius: 1rem; text-align: center; color: hsl(220 10% 60%); font-size: 0.75rem;">Nenhum Webhook configurado</div>';
  } else {
    listContainer.innerHTML = pushcuts.map((pushcut, index) => `
      <div class="pushcut-row admin-card" style="padding: 1.25rem;">
        <div style="display: flex; gap: 0.75rem; align-items: center;">
          <div style="flex: 1;"><label class="admin-label">Webhook URL</label><input type="url" oninput="pushcuts[${index}].url=this.value" class="admin-input mono" value="${pushcut.url}" /></div>
          <button onclick="removePushcutRow(${index})" class="admin-btn admin-btn-outline" style="color: #ef4444; margin-top: 1.2rem;"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </div>
        <div style="display: flex; justify-content: flex-end; margin-top: 0.75rem;">
          <button onclick="testPushcutRow(${index}, this)" class="admin-btn admin-btn-outline" style="padding: 0.625rem 0.9rem;">
            <i data-lucide="send" class="w-4 h-4"></i> Enviar teste
          </button>
        </div>
      </div>
    `).join('');
  }

  lucide.createIcons();
}

document.getElementById('btn-save-pushcuts')?.addEventListener('click', () => {
  saveSettings(document.getElementById('pushcut-save-feedback'));
});

window.testPushcutRow = (index, button) => {
  sendPushcutTest(index, button);
};

function showFeedback(element, text, isError) {
  const icon = isError
    ? '<i data-lucide="alert-circle" class="w-4 h-4"></i>'
    : '<i data-lucide="check" class="w-4 h-4"></i>';

  element.innerHTML = `${icon} <span>${text}</span>`;
  element.style.display = 'flex';
  element.style.alignItems = 'center';
  element.style.gap = '0.5rem';
  element.style.color = isError ? '#ef4444' : '#10b981';
  element.style.opacity = '1';
  lucide.createIcons();
  setTimeout(() => {
    element.style.opacity = '0';
  }, 3000);
}

window.logout = () => {
  localStorage.removeItem('aquagas_admin_token');
  window.location.href = 'login.html';
};

function initGtag() {}
function initPushcut() {}
