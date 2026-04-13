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
        lucide.createIcons();
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
    lucide.createIcons();

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
        bairro: bairroInput.value,
        cidade: cidadeInput.value,
        uf: ufInput.value.toUpperCase(),
      }
    };

    try {
      const res = await fetch('/api/pix/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao gerar Pix');
      }

      // Extract PIX data
      const pixCode = data?.data?.pix?.qrcode || data?.pix?.qrcode || '';
      const pixExpiration = data?.data?.pix?.expirationDate || data?.pix?.expirationDate || '';

      if (!pixCode) {
        throw new Error('QR Code Pix não retornado pela API');
      }

      console.log('[PIX Generated]', { code: pixCode.substring(0, 40) + '...', expiration: pixExpiration });

      // Clear cart
      localStorage.removeItem('aquagas_cart');
      localStorage.removeItem('aquagas_cep');

      // Show PIX payment screen
      showPixScreen(pixCode, pixExpiration, subtotal);

    } catch (err) {
      console.error('[PIX Error]', err);
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4 mr-2"></i> Confirmar Pedido';
      lucide.createIcons();

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

  function showPixScreen(pixCode, expiration, total) {
    const container = document.querySelector('.mx-auto.max-w-lg');

    // Calculate expiration countdown
    const expDate = expiration ? new Date(expiration) : new Date(Date.now() + 15 * 60 * 1000);
    
    container.innerHTML = `
      <div style="text-align: center; padding: 1.5rem 0;">
        <!-- PIX QR Code -->
        <div style="margin: 0 auto 1rem; display: flex; justify-content: center;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixCode)}" alt="QR Code Pix" style="border-radius: 0.5rem; border: 2px solid hsl(var(--border)); padding: 0.5rem; background: #fff;" width="200" height="200" />
        </div>

        <h2 style="font-size: 1.125rem; font-weight: 800; margin-bottom: 0.25rem;">Pagamento Pix Gerado!</h2>
        <p style="font-size: 0.8125rem; color: hsl(var(--muted-foreground)); margin-bottom: 1.25rem;">
          Copie o código abaixo e pague no seu banco
        </p>

        <!-- Total -->
        <div style="background: hsl(var(--card)); border: 1px solid hsl(var(--border)); border-radius: 1rem; padding: 1rem; margin-bottom: 1rem;">
          <p style="font-size: 0.75rem; color: hsl(var(--muted-foreground)); margin-bottom: 0.25rem;">Valor total</p>
          <p style="font-size: 1.5rem; font-weight: 800; color: hsl(var(--success));">${formatPrice(total)}</p>
        </div>

        <!-- PIX Copia e Cola -->
        <div style="background: hsl(var(--muted) / 0.3); border: 2px dashed hsl(var(--border)); border-radius: 1rem; padding: 1rem; margin-bottom: 1rem;">
          <p style="font-size: 10px; color: hsl(var(--muted-foreground)); font-weight: 600; margin-bottom: 0.5rem;">PIX COPIA E COLA</p>
          <div id="pix-code-display" style="font-family: monospace; font-size: 0.6875rem; color: hsl(var(--foreground)); word-break: break-all; line-height: 1.4; max-height: 4rem; overflow-y: auto; background: hsl(var(--card)); border-radius: 0.75rem; padding: 0.75rem; border: 1px solid hsl(var(--border));">${pixCode}</div>
        </div>

        <!-- Copy Button -->
        <button id="btn-copy-pix" style="width: 100%; background: hsl(var(--success)); color: #fff; border: none; border-radius: 0.75rem; padding: 0.875rem; font-size: 0.875rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; box-shadow: 0 4px 16px hsl(var(--success) / 0.3); margin-bottom: 1rem;">
          <i data-lucide="copy" class="w-4 h-4"></i>
          Copiar código Pix
        </button>

        <!-- Expiration Timer -->
        <div style="background: hsl(var(--card)); border: 1px solid hsl(var(--border)); border-radius: 1rem; padding: 0.75rem; margin-bottom: 1rem;">
          <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
            <i data-lucide="clock" style="width: 14px; height: 14px; color: hsl(var(--destructive));"></i>
            <span style="font-size: 0.75rem; font-weight: 600; color: hsl(var(--foreground));">Expira em: <span id="pix-timer" style="color: hsl(var(--destructive)); font-weight: 800;">15:00</span></span>
          </div>
        </div>

        <!-- Instructions -->
        <div style="background: hsl(var(--card)); border: 1px solid hsl(var(--border)); border-radius: 1rem; padding: 1rem; text-align: left; margin-bottom: 1rem;">
          <p style="font-size: 0.75rem; font-weight: 700; margin-bottom: 0.5rem;">Como pagar:</p>
          <ol style="font-size: 0.6875rem; color: hsl(var(--muted-foreground)); line-height: 1.8; padding-left: 1rem; margin: 0;">
            <li>Abra o app do seu banco</li>
            <li>Escolha pagar com <strong>Pix Copia e Cola</strong></li>
            <li>Cole o código copiado acima</li>
            <li>Confirme o pagamento</li>
          </ol>
        </div>

        <!-- Delivery Info -->
        <div style="background: hsl(var(--success) / 0.08); border-radius: 1rem; padding: 0.75rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 1rem;">
          <i data-lucide="truck" style="width: 16px; height: 16px; color: hsl(var(--success));"></i>
          <span style="font-size: 0.75rem; font-weight: 600; color: hsl(var(--success));">Entrega em 30-50 min após confirmação</span>
        </div>

        <a href="/" style="display: inline-flex; align-items: center; gap: 0.5rem; color: hsl(var(--primary)); font-size: 0.75rem; font-weight: 600; text-decoration: none;">
          ← Voltar para a loja
        </a>
      </div>
    `;

    // Copy button handler
    document.getElementById('btn-copy-pix')?.addEventListener('click', () => {
      navigator.clipboard.writeText(pixCode).then(() => {
        const btn = document.getElementById('btn-copy-pix');
        btn.innerHTML = `
          <i data-lucide="check" class="w-4 h-4"></i>
          Código copiado!
        `;
        lucide.createIcons();
        setTimeout(() => {
          btn.innerHTML = `
            <i data-lucide="copy" class="w-4 h-4"></i>
            Copiar código Pix
          `;
          lucide.createIcons();
        }, 3000);
      });
    });

    // Expiration countdown
    const timerEl = document.getElementById('pix-timer');
    const countdown = setInterval(() => {
      const remaining = Math.max(0, expDate - Date.now());
      if (remaining <= 0) {
        clearInterval(countdown);
        timerEl.textContent = 'Expirado';
        return;
      }
      const m = Math.floor(remaining / 60000).toString().padStart(2, '0');
      const s = Math.floor((remaining % 60000) / 1000).toString().padStart(2, '0');
      timerEl.textContent = `${m}:${s}`;
    }, 1000);
  }

  // Initial validation
  validateStep1();
  validateStep2();
  lucide.createIcons();
});
