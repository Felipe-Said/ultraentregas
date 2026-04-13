document.addEventListener('DOMContentLoaded', () => {
  // ─── Cart State ───
  const cart = [];
  let cepValidated = false;

  // ─── DOM References ───
  const cartDrawer = document.getElementById('cart-drawer');
  const cartOverlay = document.getElementById('cart-overlay');
  const cartItemsEl = document.getElementById('cart-items');
  const cartCountEl = document.getElementById('cart-count');
  const cartEmptyEl = document.getElementById('cart-empty');
  const cartContentEl = document.getElementById('cart-content');
  const closeCartBtn = document.getElementById('close-cart');
  const headerCartBtn = document.getElementById('header-cart-btn');
  const checkoutBtn = document.getElementById('checkout-btn');
  const clearCartBtn = document.getElementById('clear-cart-btn');
  const cartSubtotalEl = document.getElementById('cart-subtotal');
  const cartTotalEl = document.getElementById('cart-total');
  const cartEntregaEl = document.getElementById('cart-entrega');
  const cartCepInput = document.getElementById('cart-cep-input');
  const cartCepBtn = document.getElementById('cart-cep-btn');

  // ─── Cart Drawer Toggle ───
  function openCart() {
    cartDrawer.classList.add('open');
    cartOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeCart() {
    cartDrawer.classList.remove('open');
    cartOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  closeCartBtn?.addEventListener('click', closeCart);
  cartOverlay?.addEventListener('click', closeCart);
  headerCartBtn?.addEventListener('click', openCart);

  // CEP validation is handled in the unified section below (section 4-6)

  // ─── Cart Logic ───
  function parsePrice(str) {
    return parseFloat(str.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
  }

  function formatPrice(num) {
    return 'R$' + num.toFixed(2).replace('.', ',');
  }

  function addToCart(product) {
    const existing = cart.find(i => i.title === product.title && i.originalPrice === product.originalPrice);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ ...product, qty: 1 });
    }
    renderCart();
    openCart();

    window.dispatchEvent(new CustomEvent('track-event', {
      detail: { event: 'Add_To_Cart', product: product.title, price: product.originalPrice }
    }));
  }

  function updateQty(index, delta) {
    cart[index].qty += delta;
    if (cart[index].qty <= 0) {
      cart.splice(index, 1);
    }
    renderCart();
  }

  function clearCart() {
    cart.length = 0;
    renderCart();
  }

  function getSubtotal() {
    return cart.reduce((sum, item) => sum + parsePrice(item.originalPrice) * item.qty, 0);
  }

  function getTotalItems() {
    return cart.reduce((sum, item) => sum + item.qty, 0);
  }

  function renderCart() {
    const totalItems = getTotalItems();
    const subtotal = getSubtotal();

    // Badge
    if (totalItems > 0) {
      cartCountEl.textContent = totalItems;
      cartCountEl.classList.remove('hidden');
    } else {
      cartCountEl.classList.add('hidden');
    }

    // Empty vs content
    if (cart.length === 0) {
      cartEmptyEl.classList.remove('hidden');
      cartContentEl.classList.add('hidden');
      return;
    }

    cartEmptyEl.classList.add('hidden');
    cartContentEl.classList.remove('hidden');

    // Render items
    cartItemsEl.innerHTML = cart.map((item, i) => `
      <div class="flex items-center gap-3 ${i > 0 ? 'border-t border-border pt-3 mt-3' : ''}">
        <div class="h-14 w-14 rounded-xl bg-muted/40 flex items-center justify-center overflow-hidden flex-shrink-0">
          <img src="${item.img}" alt="${item.title}" class="h-12 w-12 object-contain" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[13px] font-bold text-card-foreground leading-tight">${item.title}</p>
          <p class="text-[10px] text-muted-foreground">${item.brand}</p>
          <p class="text-sm font-extrabold text-primary mt-0.5">${item.originalPrice}</p>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button onclick="window.__cartUpdateQty(${i}, -1)" class="h-7 w-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors active:scale-95"><i data-lucide="minus" class="w-3.5 h-3.5"></i></button>
          <span class="text-sm font-bold text-card-foreground w-6 text-center">${item.qty}</span>
          <button onclick="window.__cartUpdateQty(${i}, 1)" class="h-7 w-7 rounded-lg border border-border flex items-center justify-center text-card-foreground hover:bg-muted transition-colors active:scale-95"><i data-lucide="plus" class="w-3.5 h-3.5"></i></button>
        </div>
      </div>
    `).join('');

    // Subtotal & total
    cartSubtotalEl.textContent = formatPrice(subtotal);
    cartTotalEl.textContent = formatPrice(subtotal); // Free delivery

    if (!cepValidated) {
      cartEntregaEl.innerHTML = '<span class="text-primary cursor-pointer text-xs">Informe o CEP</span>';
    }
    lucide.createIcons();
  }

  // Expose to inline onclick handlers
  window.__cartUpdateQty = updateQty;

  // ─── Clear cart ───
  clearCartBtn?.addEventListener('click', () => {
    clearCart();
  });

  // ─── Checkout ───
  checkoutBtn?.addEventListener('click', () => {
    if (cart.length === 0) return;

    if (!cepValidated) {
      cartCepInput?.focus();
      cartCepInput?.classList.add('ring-2', 'ring-destructive/40');
      setTimeout(() => cartCepInput?.classList.remove('ring-2', 'ring-destructive/40'), 2000);
      return;
    }

    // Save cart and CEP to localStorage for checkout page
    localStorage.setItem('ligeirinho_cart', JSON.stringify(cart));
    localStorage.setItem('ligeirinho_cep', cartCepInput?.value?.replace(/\D/g, '') || '');

    window.dispatchEvent(new CustomEvent('track-event', {
      detail: {
        event: 'Checkout_Click',
        items: cart.map(i => ({ title: i.title, price: i.originalPrice, qty: i.qty })),
        total: formatPrice(getSubtotal())
      }
    }));

    // Redirect to checkout page
    window.location.href = '/checkout.html';
  });

  // ─── 1. Coupon Copy Logic ───
  const copyBtn = document.querySelector('button.bg-primary\\/10');
  if (copyBtn && copyBtn.innerText.includes('Copiar')) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText('LIGEIRINHO10');
      const originalText = copyBtn.innerText;
      copyBtn.innerText = 'Copiado!';
      setTimeout(() => {
        copyBtn.innerText = originalText;
      }, 2000);
    });
  }

  // ─── 2. Category Filter Logic ───
  const filterBtns = document.querySelectorAll('button:has(span.z-10)');
  const productCards = document.querySelectorAll('.bg-card.rounded-2xl.shadow-product');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      filterBtns.forEach(b => {
        b.classList.remove('bg-primary', 'text-primary-foreground');
        b.classList.add('bg-muted', 'text-muted-foreground');
        const activeBg = b.querySelector('.bg-primary.absolute');
        if (activeBg) activeBg.remove();
      });

      e.currentTarget.classList.remove('bg-muted', 'text-muted-foreground');
      e.currentTarget.classList.add('text-primary-foreground');
      e.currentTarget.innerHTML += '<div class="absolute inset-0 rounded-full bg-primary" style="opacity:1"></div>';

      const category = e.currentTarget.innerText.trim();
      
      productCards.forEach(card => {
        const title = card.querySelector('h4')?.innerText.toLowerCase() || '';
        let show = false;
        
        if (category.includes('Todos')) show = true;
        if (category.includes('Gás') && (title.includes('botijão') || title.includes('gás'))) show = true;
        if (category.includes('Água') && (title.includes('garrafão') || title.includes('água'))) show = true;
        if (category.includes('Combos') && (title.includes('+') || title.includes('2x'))) show = true;

        card.style.display = show ? 'block' : 'none';
      });
    });
  });

  // ─── 3. Purchase Button Logic (Add to Cart) ───
  const buyButtons = document.querySelectorAll('.shadow-product button.bg-primary');

  buyButtons.forEach(btn => {
    const card = btn.closest('.bg-card');
    if (!card) return;

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const title = card.querySelector('h4')?.innerText || 'Produto';
      const originalPrice = card.querySelector('.line-through')?.innerText || 'R$0,00';
      const img = card.querySelector('img')?.src || '/gas-p13.png';
      
      // Extract brand from the guarantee text (e.g. "Garantia Ultragaz" → "Ultragaz")
      const guaranteeEl = card.querySelector('.text-success')?.closest('p');
      let brand = '';
      if (guaranteeEl) {
        brand = guaranteeEl.textContent.replace('Garantia ', '').trim();
      }

      // Button feedback
      const originalHTML = btn.innerHTML;
      btn.innerHTML = `<i data-lucide="check" class="h-3.5 w-3.5"></i> <span>Adicionado!</span>`;
      btn.classList.add('bg-success');
      btn.classList.remove('bg-primary');
      lucide.createIcons();
      
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.classList.remove('bg-success');
        btn.classList.add('bg-primary');
      }, 1200);

      addToCart({ title, originalPrice, img, brand });
    });
  });

  // ─── 4. Geolocation CEP Auto-Detect ───
  const heroCepInput = document.querySelector('input[placeholder="00000-000"]');
  
  async function fetchCepFromLocation() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalização não suportada'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
              { headers: { 'Accept-Language': 'pt-BR' } }
            );
            const data = await res.json();
            const cep = data?.address?.postcode?.replace(/\D/g, '') || '';
            if (cep.length >= 8) {
              resolve(cep);
            } else {
              reject(new Error('CEP não encontrado para essa localização'));
            }
          } catch (err) {
            reject(err);
          }
        },
        (err) => {
          reject(new Error('Permissão de localização negada'));
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  function formatCepDisplay(cep) {
    const clean = cep.replace(/\D/g, '');
    if (clean.length === 8) return clean.slice(0, 5) + '-' + clean.slice(5);
    return clean;
  }

  function fillAllCepInputs(cep) {
    const formatted = formatCepDisplay(cep);
    if (heroCepInput) heroCepInput.value = formatted;
    if (cartCepInput) cartCepInput.value = formatted;
  }

  function validateCep(cepValue) {
    cepValidated = true;
    if (cartEntregaEl) {
      cartEntregaEl.textContent = 'Grátis';
      cartEntregaEl.classList.remove('text-primary');
      cartEntregaEl.classList.add('text-success', 'font-bold');
    }
    if (cartCepBtn) {
      cartCepBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i>';
      cartCepBtn.classList.add('bg-success', 'text-white');
      cartCepBtn.classList.remove('bg-primary');
      lucide.createIcons();
    }
    renderCart();
    window.dispatchEvent(new CustomEvent('track-event', {
      detail: { event: 'CEP_Filled', cep: cepValue, source: 'geolocation' }
    }));
  }

  async function handleGeolocateClick(btn) {
    const originalHTML = btn.innerHTML;
    btn.innerHTML = `<svg class="h-3 w-3 animate-spin" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke-dasharray="31.4" stroke-dashoffset="10"/></svg> Localizando...`;
    btn.disabled = true;

    try {
      const cep = await fetchCepFromLocation();
      fillAllCepInputs(cep);
      validateCep(cep);
      btn.innerHTML = `<svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg> CEP encontrado!`;
      btn.classList.add('text-success');
    } catch (err) {
      btn.innerHTML = originalHTML;
      alert(err.message || 'Não foi possível detectar seu CEP. Por favor, insira manualmente.');
    }

    btn.disabled = false;
  }

  // Inject "Usar minha localização" button into hero CEP section
  const heroCepContainer = heroCepInput?.closest('.glass-card');
  if (heroCepContainer) {
    const geoBtn = document.createElement('button');
    geoBtn.type = 'button';
    geoBtn.setAttribute('data-geo-btn', '');
    geoBtn.className = 'flex items-center gap-1 text-[11px] font-semibold text-primary-foreground/70 hover:text-primary-foreground mt-2 transition-colors mx-auto';
    geoBtn.innerHTML = `<svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2a8 8 0 0 0-8 8c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 1.202 0C14.461 20.193 20 14.993 20 10a8 8 0 0 0-8-8z" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="10" r="3"/></svg> Usar minha localização`;
    geoBtn.addEventListener('click', () => handleGeolocateClick(geoBtn));
    heroCepContainer.appendChild(geoBtn);
  }

  // Inject "Usar minha localização" link into cart drawer CEP section
  const cartCepContainer = cartCepInput?.closest('.border-t');
  if (cartCepContainer) {
    const geoLink = document.createElement('button');
    geoLink.type = 'button';
    geoLink.setAttribute('data-geo-btn', '');
    geoLink.className = 'flex items-center gap-1 text-[10px] font-semibold text-primary hover:text-primary/80 mt-2 transition-colors';
    geoLink.innerHTML = `<svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2a8 8 0 0 0-8 8c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 1.202 0C14.461 20.193 20 14.993 20 10a8 8 0 0 0-8-8z" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="10" r="3"/></svg> Usar minha localização`;
    geoLink.addEventListener('click', () => handleGeolocateClick(geoLink));
    cartCepContainer.appendChild(geoLink);
  }

  // ─── 5. Hero CEP "Continuar" button ───
  const continueBtn = heroCepInput?.closest('.flex')?.querySelector('button');
  
  if (continueBtn) {
    continueBtn.addEventListener('click', () => {
      const val = heroCepInput?.value?.replace(/\D/g, '') || '';
      if (val.length >= 8) {
        fillAllCepInputs(val);
        validateCep(val);
        alert('CEP Validado! Região com entrega grátis.');
      } else {
        alert('Por favor, insira um CEP válido.');
      }
    });
  }

  // ─── 6. Cart Drawer CEP "OK" button (already wired above, update to sync) ───
  // Override the existing handler to also fill the hero input
  cartCepBtn?.addEventListener('click', () => {
    const val = cartCepInput?.value?.replace(/\D/g, '') || '';
    if (val.length >= 8) {
      fillAllCepInputs(val);
      validateCep(val);
    }
  });

  // Initial render
  renderCart();
  lucide.createIcons();

  // ─── Auto-detect CEP on page load ───
  (async () => {
    try {
      const cep = await fetchCepFromLocation();
      fillAllCepInputs(cep);
      validateCep(cep);

      // Update the geo buttons to show success
      document.querySelectorAll('[data-geo-btn]').forEach(btn => {
        btn.innerHTML = `<svg class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" stroke-linecap="round" stroke-linejoin="round"/></svg> CEP detectado!`;
        btn.classList.add('text-success');
      });
    } catch {
      // Silently fail — user can input manually
    }
  })();
});
