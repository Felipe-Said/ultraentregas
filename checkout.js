// ─── Checkout Logic ───
document.addEventListener('DOMContentLoaded', () => {

  // ─── Load cart from localStorage ───
  const cart = JSON.parse(localStorage.getItem('aquagas_cart') || '[]');
  const cep = localStorage.getItem('aquagas_cep') || '';
  let currentStep = 1;

  // If no items, redirect back
  if (!cart.length) {
    window.location.href = '/';
    return;
  }

  // ─── Countdown Timer ───
  const countdownEl = document.getElementById('countdown');
  if (countdownEl) {
    countdownEl.textContent = 'PIX gerado apos a confirmacao';
  }

  // ─── People count ───
  const peopleEl = document.getElementById('people-count');
  if (peopleEl) {
    peopleEl.textContent = 'Atendimento online';
  }

  // ─── Stepper ───
  function goStep(step) {
    currentStep = step;
    document.querySelectorAll('.step-panel').forEach(p => p.style.display = 'none');
    const target = document.getElementById(`step-${step}`);
    if (target) target.style.display = 'block';

    // Update step circles
    document.querySelectorAll('[data-step]').forEach(c => {
      const s = parseInt(c.dataset.step);
      c.className = 'flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold transition-all';
      if (s < step) c.className += ' bg-[hsl(var(--success))] text-white';
      else if (s === step) c.className += ' bg-primary text-primary-foreground shadow-lg';
      else c.className += ' bg-muted text-muted-foreground';
    });

    // Update step lines
    document.querySelectorAll('[data-line]').forEach(l => {
      const s = parseInt(l.dataset.line);
      l.className = 'flex-1 h-0.5 mx-1 rounded';
      if (s < step) l.className += ' bg-[hsl(var(--success))]';
      else l.className += ' bg-muted';
    });

    // Update step labels
    document.querySelectorAll('[data-label]').forEach(lbl => {
      const s = parseInt(lbl.dataset.label);
      lbl.className = 'text-[10px] font-semibold';
      if (s <= step) lbl.className += ' text-foreground';
      else lbl.className += ' text-muted-foreground';
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (step === 3) renderReview();
  }
  window.goStep = goStep;

  // ─── Helpers ───
  function parsePrice(str) {
    return parseFloat(str.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
  }
  function formatPrice(num) {
    return 'R$' + num.toFixed(2).replace('.', ',');
  }

  function renderIcons() {
    window.lucide?.createIcons?.();
  }

  function formatRemainingTime(remaining) {
    const totalSeconds = Math.max(0, Math.floor(remaining / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
    }

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  function getNestedValue(source, path) {
    return path.split('.').reduce((value, key) => {
      if (value && typeof value === 'object' && key in value) {
        return value[key];
      }

      return undefined;
    }, source);
  }

  function pickFirstString(source, paths) {
    for (const path of paths) {
      const value = getNestedValue(source, path);

      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return '';
  }

  function normalizeQrCodeImage(value) {
    if (typeof value !== 'string') {
      return '';
    }

    const trimmed = value.trim();

    if (!trimmed) {
      return '';
    }

    if (/^https?:\/\//i.test(trimmed) || /^data:image\//i.test(trimmed)) {
      return trimmed;
    }

    const base64 = trimmed.replace(/\s+/g, '');

    if (/^[A-Za-z0-9+/=]+$/.test(base64) && base64.length > 128) {
      return `data:image/png;base64,${base64}`;
    }

    return '';
  }

  async function readJsonSafe(response) {
    const rawText = await response.text();

    if (!rawText) {
      return {};
    }

    try {
      return JSON.parse(rawText);
    } catch {
      throw new Error('A resposta do servidor veio em formato invalido.');
    }
  }

  function extractPixPayload(payload) {
    return {
      pixCode: pickFirstString(payload, [
        'pixCode',
        'pix.qrcode',
        'pix.qrCode',
        'pix.copyPaste',
        'pix.copy_paste',
        'pix.emv',
        'pix.payload',
        'data.pix.qrcode',
        'data.pix.qrCode',
        'data.pix.copyPaste',
        'data.pix.copy_paste',
        'data.pix.emv',
        'data.pix.payload',
        'qrcode',
        'qrCode',
        'copyPaste',
        'copy_paste',
        'emv',
        'payload'
      ]),
      qrCodeImage: normalizeQrCodeImage(pickFirstString(payload, [
        'qrCodeImage',
        'pix.qrCodeImage',
        'pix.qrcodeImage',
        'pix.qrCodeBase64',
        'pix.qrcodeBase64',
        'pix.base64Image',
        'pix.image',
        'data.pix.qrCodeImage',
        'data.pix.qrcodeImage',
        'data.pix.qrCodeBase64',
        'data.pix.qrcodeBase64',
        'data.pix.base64Image',
        'data.pix.image',
        'image',
        'base64Image'
      ])),
      expirationDate: pickFirstString(payload, [
        'expirationDate',
        'expiresAt',
        'expires_at',
        'pix.expirationDate',
        'pix.expiresAt',
        'pix.expires_at',
        'data.pix.expirationDate',
        'data.pix.expiresAt',
        'data.pix.expires_at'
      ])
    };
  }

  // ─── Masks ───
  const cpfInput = document.getElementById('inp-cpf');
  cpfInput?.addEventListener('input', () => {
    let v = cpfInput.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    cpfInput.value = v;
    validateStep1();
  });

  const phoneInput = document.getElementById('inp-phone');
  phoneInput?.addEventListener('input', () => {
    let v = phoneInput.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 6) v = v.replace(/(\d{2})(\d{5})(\d{1,4})/, '($1) $2-$3');
    else if (v.length > 2) v = v.replace(/(\d{2})(\d{1,5})/, '($1) $2');
    phoneInput.value = v;
    validateStep1();
  });

  const cepInput = document.getElementById('inp-cep');
  if (cep) cepInput.value = cep.length === 8 ? cep.slice(0, 5) + '-' + cep.slice(5) : cep;
  cepInput?.addEventListener('input', () => {
    let v = cepInput.value.replace(/\D/g, '').slice(0, 8);
    if (v.length > 5) v = v.replace(/(\d{5})(\d{1,3})/, '$1-$2');
    cepInput.value = v;
    validateStep2();
  });

  // ─── Step 1 Validation ───
  const nomeInput = document.getElementById('inp-nome');
  const emailInput = document.getElementById('inp-email');
  const btn1 = document.getElementById('btn-step1');

  function validateStep1() {
    const nome = nomeInput?.value.trim();
    const email = emailInput?.value.trim();
    const cpf = cpfInput?.value.replace(/\D/g, '');
    const phone = phoneInput?.value.replace(/\D/g, '');
    const valid = nome?.length >= 3 && email?.includes('@') && email?.includes('.') && cpf?.length === 11 && phone?.length >= 10;
    btn1.disabled = !valid;
    return valid;
  }

  [nomeInput, emailInput, cpfInput, phoneInput].forEach(el => {
    el?.addEventListener('input', validateStep1);
    el?.addEventListener('change', validateStep1);
  });

  btn1?.addEventListener('click', () => {
    if (validateStep1()) goStep(2);
  });

  // ─── Step 2: CEP auto-fill via ViaCEP ───
  const ruaInput = document.getElementById('inp-rua');
  const numInput = document.getElementById('inp-num');
  const bairroInput = document.getElementById('inp-bairro');
  const cidadeInput = document.getElementById('inp-cidade');
  const ufInput = document.getElementById('inp-uf');
  const btn2 = document.getElementById('btn-step2');
  const btnCep = document.getElementById('btn-buscar-cep');

  async function buscarCep() {
    const c = cepInput?.value.replace(/\D/g, '');
    if (c?.length !== 8) return;
    btnCep.textContent = '...';
    try {
      const res = await fetch(`https://viacep.com.br/ws/${c}/json/`);
      const data = await res.json();
      if (!data.erro) {
        if (data.logradouro) ruaInput.value = data.logradouro;
        if (data.bairro) bairroInput.value = data.bairro;
        if (data.localidade) cidadeInput.value = data.localidade;
        if (data.uf) ufInput.value = data.uf;
        btnCep.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i>';
        btnCep.style.background = 'hsl(var(--success))';
        renderIcons();
        numInput?.focus();
      } else {
        btnCep.textContent = 'Buscar';
      }
    } catch {
      btnCep.textContent = 'Buscar';
    }
    validateStep2();
  }
  btnCep?.addEventListener('click', buscarCep);

  // Auto-search when CEP fully typed
  cepInput?.addEventListener('input', () => {
    if (cepInput.value.replace(/\D/g, '').length === 8) buscarCep();
  });

  function validateStep2() {
    const c = cepInput?.value.replace(/\D/g, '');
    const valid = c?.length === 8 && ruaInput?.value.trim().length >= 2 && numInput?.value.trim().length >= 1 && bairroInput?.value.trim().length >= 2 && cidadeInput?.value.trim().length >= 2 && ufInput?.value.trim().length === 2;
    btn2.disabled = !valid;
    return valid;
  }

  [cepInput, ruaInput, numInput, bairroInput, cidadeInput, ufInput].forEach(el => {
    el?.addEventListener('input', validateStep2);
    el?.addEventListener('change', validateStep2);
  });

  btn2?.addEventListener('click', () => {
    if (validateStep2()) goStep(3);
  });

  // ─── Step 3: Review ───
  function renderReview() {
    const itemsEl = document.getElementById('order-items');
    const subtotal = cart.reduce((s, i) => s + parsePrice(i.originalPrice) * i.qty, 0);

    itemsEl.innerHTML = cart.map(item => `
      <div class="cart-summary-item">
        <div style="width: 48px; height: 48px; border-radius: 0.75rem; background: hsl(var(--muted) / 0.4); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;">
          <img src="${item.img}" alt="${item.title}" style="width: 40px; height: 40px; object-fit: contain;" />
        </div>
        <div style="flex: 1; min-width: 0;">
          <p style="font-size: 0.8125rem; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.title}</p>
          <p style="font-size: 10px; color: hsl(var(--muted-foreground));">${item.brand || ''} • Qtd: ${item.qty}</p>
          <p style="font-size: 0.875rem; font-weight: 800; color: hsl(var(--primary)); margin-top: 2px;">${item.originalPrice} ${item.qty > 1 ? '× ' + item.qty : ''}</p>
        </div>
      </div>
    `).join('');

    document.getElementById('review-subtotal').textContent = formatPrice(subtotal);
    document.getElementById('review-total').textContent = formatPrice(subtotal);

    const addr = `${ruaInput.value}, ${numInput.value}${document.getElementById('inp-comp').value ? ' — ' + document.getElementById('inp-comp').value : ''}, ${bairroInput.value}, ${cidadeInput.value} - ${ufInput.value.toUpperCase()}, CEP ${cepInput.value}`;
    document.getElementById('delivery-address').textContent = addr;
  }

  // ─── Confirm Order → Generate PIX ───
  const confirmBtn = document.getElementById('btn-confirm');
  confirmBtn?.addEventListener('click', async () => {
    const subtotal = cart.reduce((s, i) => s + parsePrice(i.originalPrice) * i.qty, 0);
    const amountCents = Math.round(subtotal * 100);

    // Show loading
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span class="flex items-center gap-2"><i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Gerando Pix...</span>';
    renderIcons();

    const orderPayload = {
      amount: amountCents,
      items: cart.map(i => ({
        title: i.title,
        unitPrice: Math.round(parsePrice(i.originalPrice) * 100),
        quantity: i.qty,
        tangible: true
      })),
      customer: {
        name: nomeInput.value.trim(),
        email: emailInput.value.trim(),
        cpf: cpfInput.value,
        phone: phoneInput.value,
      },
      shipping: {
        cep: cepInput.value,
        rua: ruaInput.value,
        numero: numInput.value,
        complemento: document.getElementById('inp-comp')?.value.trim() || '',
        bairro: bairroInput.value,
        cidade: cidadeInput.value,
        uf: ufInput.value.toUpperCase(),
      }
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      let res;

      try {
        res = await fetch('/api/pix/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderPayload),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const data = await readJsonSafe(res);

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao gerar Pix');
      }

      const pixPayload = extractPixPayload(data);
      const pixCode = pixPayload.pixCode;
      const pixExpiration = pixPayload.expirationDate;
      const qrCodeImage = pixPayload.qrCodeImage;

      if (!pixCode) {
        throw new Error('O servidor não retornou o código Pix para pagamento.');
      }

      console.log('[PIX Generated]', { code: pixCode.substring(0, 40) + '...', expiration: pixExpiration });

      // Clear cart
      localStorage.removeItem('aquagas_cart');
      localStorage.removeItem('aquagas_cep');

      // Show PIX payment screen
      showPixScreen(pixCode, pixExpiration, subtotal, qrCodeImage);

    } catch (err) {
      if (err.name === 'AbortError') {
        err = new Error('A geração do Pix demorou demais. Tente novamente.');
      }

      console.error('[PIX Error]', err);
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4 mr-2"></i> Confirmar Pedido';
      renderIcons();

      // Show error inline
      const container = confirmBtn.parentElement;
      let errEl = container.querySelector('.pix-error');
      if (!errEl) {
        errEl = document.createElement('div');
        errEl.className = 'pix-error';
        container.appendChild(errEl);
      }
      errEl.innerHTML = `
        <div class="mt-3 p-3 bg-destructive/10 rounded-xl text-xs text-destructive font-semibold flex items-center gap-2">
          <i data-lucide="alert-circle" class="w-3.5 h-3.5"></i>
          ${err.message}
        </div>
      `;
      setTimeout(() => errEl.remove(), 5000);
    }
  });

  function showPixScreen(pixCode, expiration, total, qrCodeImage = '') {
    const container = document.getElementById('checkout-shell');

    if (!container) {
      throw new Error('Container principal do checkout nao encontrado.');
    }

    const pixQrCodeSrc = qrCodeImage || `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(pixCode)}`;
    const parsedExpiration = expiration ? new Date(expiration) : new Date(Date.now() + 15 * 60 * 1000);
    const expDate = Number.isNaN(parsedExpiration.getTime()) ? new Date(Date.now() + 15 * 60 * 1000) : parsedExpiration;
    const expirationLabel = expDate.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    container.innerHTML = `
      <section class="gradient-hero relative overflow-hidden rounded-[2rem] px-4 pt-5 pb-6 shadow-hero-card">
        <div class="absolute inset-0 gradient-hero-glow pointer-events-none rounded-[2rem]"></div>
        <div class="absolute -top-10 left-0 h-28 w-28 rounded-full bg-primary-foreground/10 blur-3xl"></div>
        <div class="absolute bottom-0 right-0 h-36 w-36 rounded-full bg-primary-foreground/10 blur-3xl"></div>
        <div class="relative z-10">
          <div class="flex items-center justify-between gap-3">
            <div class="inline-flex items-center gap-2 rounded-full bg-primary-foreground/10 px-3 py-1.5 backdrop-blur-sm">
              <span class="h-2 w-2 rounded-full bg-success animate-pulse-soft"></span>
              <span class="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-foreground/90">Pix aguardando pagamento</span>
            </div>
            <div class="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 py-1.5 text-[11px] font-semibold text-primary-foreground/80 backdrop-blur-sm">
              <i data-lucide="shield-check" class="h-3.5 w-3.5"></i>
              Pedido protegido
            </div>
          </div>

          <div class="mt-5 text-center">
            <p class="text-xs font-semibold uppercase tracking-[0.24em] text-primary-foreground/60">Finalize no seu banco</p>
            <h2 class="mt-2 font-display text-3xl font-extrabold leading-tight text-primary-foreground">Seu Pix ja esta pronto</h2>
            <p class="mt-3 text-sm leading-relaxed text-primary-foreground/72">
              Escaneie o QR Code ou copie a chave abaixo para concluir o pagamento e liberar a entrega.
            </p>
          </div>

          <div class="mt-5 glass-card rounded-[1.75rem] border border-primary-foreground/10 p-4 shadow-hero-card">
            <div class="grid gap-4 sm:grid-cols-[1.05fr_0.95fr] sm:items-center">
              <div class="rounded-[1.5rem] bg-white p-3 shadow-product">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-[11px] font-bold uppercase tracking-[0.18em] text-primary/70">QR Code Pix</span>
                  <span class="rounded-full bg-success/10 px-2.5 py-1 text-[10px] font-bold text-success">Entrega liberada apos pagar</span>
                </div>
                <div class="mt-3 rounded-[1.25rem] bg-muted/40 p-3">
                  <img src="${pixQrCodeSrc}" alt="QR Code Pix" class="mx-auto h-auto w-full max-w-[240px] rounded-2xl bg-white p-2 shadow-product" width="240" height="240" />
                </div>
              </div>

              <div class="space-y-3">
                <div class="rounded-[1.5rem] bg-white p-4 shadow-product">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Valor total</p>
                  <p class="mt-2 font-display text-4xl font-extrabold leading-none text-card-foreground">${formatPrice(total)}</p>
                  <p class="mt-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <i data-lucide="truck" class="h-3.5 w-3.5 text-success"></i>
                    Frete gratis e entrega em 30-50 min
                  </p>
                </div>

                <div class="rounded-[1.5rem] bg-white p-4 shadow-product">
                  <div class="flex items-center justify-between gap-3">
                    <div>
                      <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Tempo para pagar</p>
                      <p id="pix-timer" class="mt-2 font-display text-2xl font-extrabold text-destructive">15:00</p>
                    </div>
                    <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                      <i data-lucide="clock-3" class="h-5 w-5"></i>
                    </div>
                  </div>
                  <p class="mt-2 text-xs text-muted-foreground">Valido ate ${expirationLabel}</p>
                </div>

                <div class="gradient-trust rounded-[1.5rem] border border-success/10 p-4">
                  <div class="flex items-start gap-3">
                    <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-success/12 text-success">
                      <i data-lucide="badge-check" class="h-5 w-5"></i>
                    </div>
                    <div>
                      <p class="text-sm font-bold text-card-foreground">Pagamento identificado automaticamente</p>
                      <p class="mt-1 text-xs leading-relaxed text-muted-foreground">
                        Assim que o Pix for compensado, seu pedido entra na fila de expedicao e nossa equipe confirma a entrega.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-4 flex items-center justify-between gap-3 rounded-[1.25rem] bg-primary/5 px-3.5 py-3">
              <div class="flex items-center gap-2">
                <div class="flex -space-x-1.5">
                  <img alt="Fabio R." class="h-8 w-8 rounded-full border-2 border-card object-cover" src="/fabioreview-ft%20perfil.jpg" />
                  <img alt="Carla M." class="h-8 w-8 rounded-full border-2 border-card object-cover" src="/carlareview-ft%20perfil.jpg" />
                  <img alt="Maria S." class="h-8 w-8 rounded-full border-2 border-card object-cover" src="/mariareview-ft%20perfil.jpg" />
                </div>
                <div>
                  <p class="text-xs font-bold text-card-foreground">Atendimento online acompanhando seu pedido</p>
                  <p class="text-[11px] text-muted-foreground">Confirmacao manual e suporte rapido apos o pagamento.</p>
                </div>
              </div>
              <div class="hidden rounded-full bg-white px-3 py-1 text-[11px] font-bold text-primary shadow-product sm:block">Suporte ativo</div>
            </div>
          </div>
        </div>
      </section>

      <section class="mt-4 space-y-4 pb-2">
        <div class="bg-card rounded-[1.75rem] border border-border p-4 shadow-product">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70">Pix copia e cola</p>
              <h3 class="mt-1 font-display text-2xl font-extrabold text-card-foreground">Pague sem erro no app do seu banco</h3>
            </div>
            <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <i data-lucide="copy-check" class="h-5 w-5"></i>
            </div>
          </div>

          <div id="pix-code-display" class="mt-4 rounded-[1.25rem] border border-border bg-muted/30 px-4 py-3 font-mono text-[12px] leading-6 text-card-foreground break-all">${pixCode}</div>

          <button id="btn-copy-pix" class="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground transition-all hover:brightness-110 shadow-hero-card">
            <i data-lucide="copy" class="h-4 w-4"></i>
            Copiar codigo Pix
          </button>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
          <div class="bg-card rounded-[1.75rem] border border-border p-4 shadow-product">
            <div class="flex items-center gap-3">
              <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                <i data-lucide="list-checks" class="h-5 w-5"></i>
              </div>
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Como pagar</p>
                <h3 class="text-lg font-bold text-card-foreground">Siga estes passos</h3>
              </div>
            </div>

            <div class="mt-4 space-y-3">
              <div class="flex items-start gap-3">
                <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-extrabold text-primary">1</div>
                <p class="text-sm leading-relaxed text-muted-foreground">Abra o app do seu banco ou carteira digital.</p>
              </div>
              <div class="flex items-start gap-3">
                <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-extrabold text-primary">2</div>
                <p class="text-sm leading-relaxed text-muted-foreground">Escolha pagar com Pix Copia e Cola ou leia o QR Code.</p>
              </div>
              <div class="flex items-start gap-3">
                <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-extrabold text-primary">3</div>
                <p class="text-sm leading-relaxed text-muted-foreground">Cole o codigo acima e confira o valor do pedido.</p>
              </div>
              <div class="flex items-start gap-3">
                <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-extrabold text-primary">4</div>
                <p class="text-sm leading-relaxed text-muted-foreground">Conclua o pagamento para liberar a confirmacao.</p>
              </div>
            </div>
          </div>

          <div class="bg-card rounded-[1.75rem] border border-border p-4 shadow-product">
            <div class="flex items-center gap-3">
              <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-success/12 text-success">
                <i data-lucide="shield" class="h-5 w-5"></i>
              </div>
              <div>
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Pedido protegido</p>
                <h3 class="text-lg font-bold text-card-foreground">Tudo pronto para confirmar</h3>
              </div>
            </div>

            <div class="mt-4 space-y-3">
              <div class="rounded-[1.25rem] bg-muted/30 px-4 py-3">
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Validade do codigo</p>
                <p class="mt-1 text-sm font-bold text-card-foreground">${expirationLabel}</p>
              </div>
              <div class="rounded-[1.25rem] bg-muted/30 px-4 py-3">
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Confirmacao do pedido</p>
                <p class="mt-1 text-sm text-muted-foreground">Nossa equipe recebe a confirmacao do Pix e inicia a entrega logo em seguida.</p>
              </div>
              <div class="rounded-[1.25rem] bg-muted/30 px-4 py-3">
                <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Precisa de ajuda?</p>
                <p class="mt-1 text-sm text-muted-foreground">Mantenha esta tela aberta ate concluir o pagamento para evitar qualquer interrupcao.</p>
              </div>
            </div>
          </div>
        </div>

        <a href="/" class="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-4 py-3.5 text-sm font-bold text-card-foreground shadow-product transition-colors hover:bg-muted/40">
          <i data-lucide="arrow-left" class="h-4 w-4"></i>
          Voltar para a loja
        </a>
      </section>
    `;

    const copyButton = document.getElementById('btn-copy-pix');
    copyButton?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(pixCode);

        copyButton.innerHTML = `
          <i data-lucide="check" class="h-4 w-4"></i>
          Codigo copiado!
        `;
        renderIcons();

        window.setTimeout(() => {
          copyButton.innerHTML = `
            <i data-lucide="copy" class="h-4 w-4"></i>
            Copiar codigo Pix
          `;
          renderIcons();
        }, 3000);
      } catch {
        copyButton.innerHTML = `
          <i data-lucide="alert-circle" class="h-4 w-4"></i>
          Copie manualmente o codigo abaixo
        `;
        renderIcons();
      }
    });

    const timerEl = document.getElementById('pix-timer');
    const updateTimer = () => {
      if (!timerEl) {
        return;
      }

      const remaining = Math.max(0, expDate - Date.now());

      if (remaining <= 0) {
        timerEl.textContent = 'Expirado';
        return true;
      }

      timerEl.textContent = formatRemainingTime(remaining);
      return false;
    };

    renderIcons();

    if (updateTimer()) {
      return;
    }

    const countdown = setInterval(() => {
      if (updateTimer()) {
        clearInterval(countdown);
      }
    }, 1000);
  }

  // Initial validation
  validateStep1();
  validateStep2();
  renderIcons();
});
