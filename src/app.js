import { CATEGORIES, filterProducts, formatIDR, totalStock } from './catalog.js';
import { garmentDataUrl } from './garments.js';
import {
  addToCart,
  cartCount,
  maxQtyFor,
  removeFromCart,
  setQty,
  summarizeCart,
} from './cart.js';
import { computeDashboard } from './analytics.js';
import { browserStorage, createStore, STORAGE_KEY } from './store.js';
import { recommendSize, sizeConfidence } from './sizing.js';
import { TryOnAR, loadGarmentImage } from './ar.js';
import {
  formatOrderDate,
  orderItemCount,
  orderProgress,
  orderStatusLabel,
  orderStatusStyle,
} from './orders.js';

const $ = (id) => document.getElementById(id);

const store = createStore(browserStorage());

const state = {
  filters: { category: 'all', query: '', sort: 'popular' },
  wishOnly: false,
  product: null,
  color: null,
  size: null,
  promo: store.getState().promo || '',
  arProduct: null,
  arColor: null,
  arSize: null,
  lastOrderId: null,
};

let ar = null;
let searchTimer = 0;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function stars(rating) {
  const full = Math.round(Number(rating) || 0);
  return '★'.repeat(full) + '☆'.repeat(Math.max(0, 5 - full));
}

function discountPercent(product) {
  if (!product.originalPrice || product.originalPrice <= product.price) return 0;
  return Math.round((1 - product.price / product.originalPrice) * 100);
}

function firstAvailableSize(product) {
  return product.sizes.find((size) => Number(product.stock?.[size] || 0) > 0) || product.sizes[0];
}

function colorHex(product, name) {
  return product.colors.find((c) => c.name === name)?.hex || product.colors[0]?.hex || '#24252a';
}

function toast(message, type = 'success') {
  const stack = $('toastStack');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 260);
  }, 2600);
}

function openModal(id) {
  const el = $(id);
  if (!el) return;
  el.classList.add('open');
  el.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const el = $(id);
  if (!el) return;
  el.classList.remove('open');
  el.setAttribute('aria-hidden', 'true');
  if (id === 'arModal' && ar) ar.stop();
  if (!document.querySelector('.modal.open') && !document.querySelector('.drawer.open')) {
    document.body.style.overflow = '';
  }
}

function closeMobileMenu() {
  const menu = $('mobileMenu');
  if (!menu) return;
  menu.hidden = true;
  $('navToggle')?.setAttribute('aria-expanded', 'false');
}

/* ------------------------------------------------------------------ */
/* Catalog                                                             */
/* ------------------------------------------------------------------ */

function renderCategories() {
  const wrap = $('categoryChips');
  wrap.innerHTML = CATEGORIES.map(
    (cat) =>
      `<button class="chip${state.filters.category === cat.id ? ' active' : ''}" data-category="${cat.id}" role="tab">${esc(cat.label)}</button>`,
  ).join('');
}

function productCard(product) {
  const discount = discountPercent(product);
  const stock = totalStock(product);
  const wished = store.isWishlisted(product.id);
  const badge = product.badge
    ? `<span class="pc-badge${product.badge === 'Best Seller' || product.badge === 'Favorit' ? '' : ' gold'}">${esc(product.badge)}</span>`
    : '';
  const colors = product.colors
    .map((c) => `<span class="pc-dot" style="background:${esc(c.hex)}" title="${esc(c.name)}"></span>`)
    .join('');
  const out = stock <= 0 ? ' · Habis' : '';

  return `
    <article class="product-card" data-id="${product.id}">
      <div class="pc-media" data-action="detail">
        ${badge}
        <span class="pc-ar-tag">✦ AR</span>
        <button class="pc-wish${wished ? ' active' : ''}" type="button" data-action="wish" data-id="${product.id}" aria-label="${wished ? 'Hapus dari' : 'Simpan ke'} favorit" aria-pressed="${wished}">
          <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true"><path d="M12 20s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.4-7 10-7 10Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
        </button>
        <img src="${garmentDataUrl(product.type, product.colors[0]?.hex)}" alt="${esc(product.name)}" />
      </div>
      <div class="pc-body">
        <span class="pc-category">${esc(CATEGORIES.find((c) => c.id === product.category)?.label || product.category)}</span>
        <h3 class="pc-name" data-action="detail">${esc(product.name)}</h3>
        <div class="pc-rating">
          <span class="pc-stars">${stars(product.rating)}</span>
          <b>${product.rating.toFixed(1)}</b>
          <span>· ${product.sold.toLocaleString('id-ID')} terjual${out}</span>
        </div>
        <div class="pc-colors">${colors}<span style="font-size:10px;color:var(--muted);margin-left:3px">${product.colors.length} warna</span></div>
        <div class="pc-price-row">
          <span class="pc-price">${formatIDR(product.price)}</span>
          ${product.originalPrice ? `<s class="pc-original">${formatIDR(product.originalPrice)}</s>` : ''}
          ${discount ? `<span class="pc-discount">-${discount}%</span>` : ''}
        </div>
        <div class="pc-actions">
          <button class="btn pc-try" data-action="tryon">Coba AR</button>
          <button class="btn btn-ghost" data-action="add">+ Keranjang</button>
        </div>
      </div>
    </article>`;
}

function renderProducts() {
  let products = filterProducts(store.getProducts(), state.filters);
  if (state.wishOnly) products = products.filter((p) => store.isWishlisted(p.id));

  $('productGrid').innerHTML = products.map(productCard).join('');
  const empty = products.length === 0;
  $('emptyState').hidden = !empty;
  $('productGrid').hidden = empty;

  if (empty) {
    $('emptyEmoji').textContent = state.wishOnly ? '♡' : '🔍';
    $('emptyTitle').textContent = state.wishOnly ? 'Belum ada favorit' : 'Produk tidak ditemukan';
    $('emptyText').textContent = state.wishOnly
      ? 'Tekan ikon hati pada produk untuk menyimpannya di sini.'
      : 'Coba kata kunci lain atau pilih kategori “Semua”.';
    $('resetFilters').textContent = state.wishOnly ? 'Lihat semua produk' : 'Reset filter';
  }
}

function refreshWishUI() {
  const wished = store.getWishlist();
  const count = wished.length;

  $('wishCount').textContent = count;
  $('wishCount').hidden = count === 0;
  $('wishButton').classList.toggle('active', state.wishOnly);
  $('wishButton').setAttribute('aria-pressed', String(state.wishOnly));
  $('wishFilterCount').textContent = count;
  $('wishFilter').classList.toggle('active', state.wishOnly);
  $('wishFilter').setAttribute('aria-pressed', String(state.wishOnly));

  if ($('pmWish')) {
    const active = state.product ? store.isWishlisted(state.product.id) : false;
    $('pmWish').classList.toggle('active', active);
    $('pmWish').setAttribute('aria-pressed', String(active));
    $('pmWish').setAttribute('aria-label', active ? 'Hapus dari favorit' : 'Simpan ke favorit');
  }
}

function setWishOnly(value) {
  state.wishOnly = value;
  refreshWishUI();
  renderProducts();
  if (value) $('katalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ------------------------------------------------------------------ */
/* Product modal                                                       */
/* ------------------------------------------------------------------ */

function renderProductModal() {
  const p = state.product;
  if (!p) return;

  const discount = discountPercent(p);
  const hex = colorHex(p, state.color);
  const image = $('pmImage');
  image.src = garmentDataUrl(p.type, hex);
  image.alt = p.name;

  $('pmCategory').textContent = CATEGORIES.find((c) => c.id === p.category)?.label || p.category;
  $('pmName').textContent = p.name;
  $('pmStars').textContent = stars(p.rating);
  $('pmRating').textContent = p.rating.toFixed(1);
  $('pmSold').textContent = `· ${p.sold.toLocaleString('id-ID')} terjual · ${totalStock(p)} stok`;
  $('pmPrice').textContent = formatIDR(p.price);
  $('pmOriginal').textContent = p.originalPrice ? formatIDR(p.originalPrice) : '';
  $('pmOriginal').hidden = !p.originalPrice;
  $('pmDiscount').textContent = discount ? `Hemat ${discount}%` : '';
  $('pmDiscount').hidden = !discount;
  $('pmDesc').textContent = p.description;

  const badge = $('pmBadge');
  badge.textContent = p.badge || '';
  badge.hidden = !p.badge;

  $('pmColorName').textContent = state.color;

  $('pmColors').innerHTML = p.colors
    .map(
      (c) => `<button class="pm-thumb${c.name === state.color ? ' active' : ''}" data-thumb="${esc(c.name)}" title="${esc(c.name)}">
        <img src="${garmentDataUrl(p.type, c.hex)}" alt="${esc(c.name)}" />
      </button>`,
    )
    .join('');

  $('pmSwatches').innerHTML = p.colors
    .map(
      (c) => `<button class="swatch${c.name === state.color ? ' active' : ''}" style="background:${esc(c.hex)}" data-color="${esc(c.name)}" title="${esc(c.name)}" aria-label="Warna ${esc(c.name)}"></button>`,
    )
    .join('');

  $('pmSizeName').textContent = state.size;
  $('pmSizes').innerHTML = p.sizes
    .map((size) => {
      const qty = Number(p.stock?.[size] || 0);
      return `<button class="size-btn${size === state.size ? ' active' : ''}" data-size="${size}" ${qty <= 0 ? 'disabled' : ''}>${size}${qty > 0 ? '' : ' · habis'}</button>`;
    })
    .join('');

  refreshWishUI();
}

function openProduct(id) {
  const p = store.getProduct(id);
  if (!p) return;
  state.product = p;
  state.color = p.colors[0]?.name;
  state.size = firstAvailableSize(p);
  $('sizeHelperForm').hidden = true;
  $('sizeHelperResult').textContent = '';
  renderProductModal();
  openModal('productModal');
}

/* ------------------------------------------------------------------ */
/* AR try-on                                                           */
/* ------------------------------------------------------------------ */

function ensureAR() {
  if (ar) return ar;
  ar = new TryOnAR({
    video: $('arVideo'),
    canvas: $('arCanvas'),
    onStatus: (text) => {
      $('arStatus').textContent = text;
    },
    onMode: () => updateArModeUI(),
  });
  return ar;
}

function updateArModeUI() {
  const mode = ar?.mode || 'idle';
  document.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === (mode === 'idle' ? 'ar' : mode));
  });
  const chip = $('arLiveChip');
  if (chip) chip.classList.toggle('offline', mode !== 'ar');
  if ($('arFps')) {
    $('arFps').textContent = mode === 'ar' ? 'AR Live' : mode === 'mannequin' ? 'Mannequin' : 'Standby';
  }
  $('arTip').textContent =
    mode === 'ar'
      ? 'Berdiri 1,5–2 m dari kamera. Seluruh badan terlihat = hasil terbaik.'
      : mode === 'mannequin'
        ? 'Mode mannequin — tanpa kamera. Atur skala dan posisi pakaian di panel kanan.'
        : 'Izinkan kamera untuk mencoba pakaian secara langsung.';
}

function renderArPanel() {
  const p = state.arProduct;
  if (!p) return;
  $('arTitle').textContent = p.name;
  $('arProductChip').textContent = p.name;
  $('arColorName').textContent = state.arColor;
  $('arSizeName').textContent = state.arSize;
  $('arSwatches').innerHTML = p.colors
    .map(
      (c) => `<button class="swatch${c.name === state.arColor ? ' active' : ''}" style="background:${esc(c.hex)}" data-ar-color="${esc(c.name)}" title="${esc(c.name)}"></button>`,
    )
    .join('');
  $('arSizes').innerHTML = p.sizes
    .map((s) => `<button class="size-btn${s === state.arSize ? ' active' : ''}" data-ar-size="${s}">${s}</button>`)
    .join('');
  $('arScale').value = '1';
  $('arOffset').value = '0';
  $('arOpacity').value = '1';
  $('arScaleVal').textContent = '1.00×';
  $('arOffsetVal').textContent = '0%';
  $('arOpacityVal').textContent = '100%';
}

async function applyArGarment() {
  const p = state.arProduct;
  if (!p || !ar) return;
  const hex = colorHex(p, state.arColor);
  const image = await loadGarmentImage(garmentDataUrl(p.type, hex));
  ar.setGarment({ type: p.type, colorHex: hex, image });
}

async function openTryOn(productId, { color, size } = {}) {
  const p = store.getProduct(productId);
  if (!p) return;

  state.arProduct = p;
  state.arColor = color && p.colors.some((c) => c.name === color) ? color : p.colors[0]?.name;
  state.arSize = size || firstAvailableSize(p);

  renderArPanel();
  ensureAR();
  await applyArGarment();

  openModal('arModal');
  updateArModeUI();

  const mode = await ar.start();
  updateArModeUI();
  store.recordTryOn(p.id, mode);
  refreshStats();
  if (mode === 'mannequin') {
    toast('Kamera tidak aktif — beralih ke mode mannequin.', 'error');
  }
}

async function switchArMode(mode) {
  if (!ar) return;
  if (mode === 'mannequin') {
    ar.setMode('mannequin');
    $('arStatus').textContent = 'Mode mannequin aktif. Pakaian bisa diatur manual.';
    updateArModeUI();
    return;
  }

  if (ar.stream) {
    ar.setMode('ar');
    $('arStatus').textContent = 'AR aktif — berdiri 1,5–2 m dari kamera.';
    updateArModeUI();
    return;
  }

  $('arStatus').textContent = 'Menyalakan kamera…';
  const started = await ar.start();
  updateArModeUI();
  if (started === 'mannequin') toast('Kamera tidak tersedia. Tetap di mode mannequin.', 'error');
}

/* ------------------------------------------------------------------ */
/* Cart                                                                */
/* ------------------------------------------------------------------ */

function cartItemHTML(item) {
  const max = maxQtyFor(store.getCart(), item.key);
  const atMax = Number.isFinite(max) && item.qty >= max;
  return `
    <div class="cart-item" data-key="${esc(item.key)}">
      <div class="ci-media"><img src="${garmentDataUrl(item.type, item.colorHex)}" alt="${esc(item.name)}" /></div>
      <div>
        <div class="ci-top">
          <div class="ci-name">${esc(item.name)}</div>
          <button class="ci-remove" data-remove="${esc(item.key)}" aria-label="Hapus">✕</button>
        </div>
        <div class="ci-meta">Ukuran ${esc(item.size)} · ${esc(item.color)}${atMax ? ' · stok maks' : ''}</div>
        <div class="ci-bottom">
          <div class="qty">
            <button data-qty="-1" data-key="${esc(item.key)}" aria-label="Kurangi">−</button>
            <span>${item.qty}</span>
            <button data-qty="1" data-key="${esc(item.key)}" aria-label="Tambah" ${atMax ? 'disabled' : ''}>+</button>
          </div>
          <div class="ci-price">${formatIDR(item.price * item.qty)}</div>
        </div>
      </div>
    </div>`;
}

function renderCart() {
  const cart = store.getCart();
  const summary = summarizeCart(cart, state.promo);
  const count = cartCount(cart);

  $('cartCount').textContent = count;
  $('cartButton').setAttribute('aria-label', `Buka keranjang, ${count} item`);

  $('cartItems').innerHTML = cart.items.map(cartItemHTML).join('');
  $('cartEmpty').hidden = cart.items.length > 0;
  $('cartItems').hidden = cart.items.length === 0;
  $('cartFoot').hidden = cart.items.length === 0;

  $('sumSubtotal').textContent = formatIDR(summary.subtotal);
  $('discountLine').hidden = summary.discount <= 0;
  $('sumDiscount').textContent = `-${formatIDR(summary.discount)}`;
  $('sumShipping').textContent = summary.shipping === 0 ? 'Gratis' : formatIDR(summary.shipping);
  $('sumTotal').textContent = formatIDR(summary.total);
  $('promoInput').value = state.promo;

  if (!cart.items.length) return;
}

function openCart() {
  renderCart();
  $('cartDrawer').classList.add('open');
  $('cartDrawer').setAttribute('aria-hidden', 'false');
  document.body.classList.add('drawer-open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  $('cartDrawer').classList.remove('open');
  $('cartDrawer').setAttribute('aria-hidden', 'true');
  document.body.classList.remove('drawer-open');
  if (!document.querySelector('.modal.open')) document.body.style.overflow = '';
}

function updateCart(cart) {
  store.setCart(cart);
  renderCart();
  refreshStats();
  refreshWishUI();
}

/* ------------------------------------------------------------------ */
/* Customer orders                                                     */
/* ------------------------------------------------------------------ */

function orderCardHTML(order) {
  const style = orderStatusStyle(order.status);
  const steps = orderProgress(order.status);
  const progress = steps
    .map(
      (step) =>
        `<div class="order-step${step.done ? ' done' : ''}${step.current ? ' current' : ''}"><i></i>${esc(step.label)}</div>`,
    )
    .join('');
  const items = (order.items || [])
    .map(
      (item) => `
      <div class="order-item">
        <div class="order-item-media"><img src="${garmentDataUrl(item.type, item.colorHex)}" alt="" /></div>
        <div class="order-item-name">${esc(item.name)}<small>Ukuran ${esc(item.size)} · ${esc(item.color)} ×${item.qty}</small></div>
        <div class="order-item-price">${formatIDR(Number(item.price || 0) * Number(item.qty || 0))}</div>
      </div>`,
    )
    .join('');

  const cancelled =
    order.status === 'cancelled' || order.status === 'refunded'
      ? '<div class="order-cancelled">Pesanan ini dibatalkan. Hubungi CS bila butuh bantuan.</div>'
      : '';

  return `
    <article class="order-card" data-order="${esc(order.id)}">
      <div class="order-top">
        <div>
          <div class="order-id">${esc(order.id)}</div>
          <div class="order-date">${formatOrderDate(order.createdAt, true)} · ${orderItemCount(order)} item</div>
        </div>
        <span class="order-badge" style="color:${style.color};background:${style.bg}">${esc(orderStatusLabel(order.status))}</span>
      </div>
      ${
        order.status === 'cancelled' || order.status === 'refunded'
          ? cancelled
          : `<div class="order-progress">${progress}</div>`
      }
      <div class="order-items">${items}</div>
      <div class="order-totals">
        <div class="order-total-row"><span>Subtotal</span><span>${formatIDR(Number(order.subtotal ?? order.total ?? 0))}</span></div>
        ${Number(order.discount || 0) > 0 ? `<div class="order-total-row"><span>Diskon promo</span><span>-${formatIDR(Number(order.discount))}</span></div>` : ''}
        <div class="order-total-row"><span>Ongkir</span><span>${Number(order.shipping || 0) === 0 ? 'Gratis' : formatIDR(Number(order.shipping))}</span></div>
        <div class="order-total-row grand"><span>Total</span><b>${formatIDR(Number(order.total || 0))}</b></div>
      </div>
      <div class="order-card-foot">
        <span class="order-hint">${order.city ? `Dikirim ke ${esc(order.city)}` : 'Pesanan web'}${order.promoLabel ? ` · ${esc(order.promoLabel)}` : ''}</span>
        <button class="btn btn-ghost" data-reorder="${esc(order.id)}">Beli lagi</button>
      </div>
    </article>`;
}

function renderOrders() {
  const orders = [...store.getOrders()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  $('ordersList').innerHTML = orders.map(orderCardHTML).join('');
  $('ordersList').hidden = orders.length === 0;
  $('ordersEmpty').hidden = orders.length > 0;
}

function openOrders() {
  renderOrders();
  openModal('ordersModal');
}

function showSuccess(order) {
  state.lastOrderId = order?.id || null;
  $('successOrderId').textContent = order?.id || 'ORD-0000';
  $('successCopy').textContent = `Terima kasih${order?.customer ? `, ${order.customer}` : ''}! Pesananmu sedang kami siapkan.`;
  openModal('successModal');
}

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

function refreshStats() {
  const s = store.getState();
  const dash = computeDashboard(s.products, s.orders, s.tryons);
  $('statProducts').textContent = s.products.filter((p) => p.ar).length;
  $('statTries').textContent = dash.tryOnsToday;
  $('cartCount').textContent = cartCount(s.cart);
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

function bindEvents() {
  $('categoryChips').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-category]');
    if (!btn) return;
    state.filters.category = btn.dataset.category;
    renderCategories();
    renderProducts();
  });

  $('sortSelect').addEventListener('change', (e) => {
    state.filters.sort = e.target.value;
    renderProducts();
  });

  $('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    const value = e.target.value;
    searchTimer = setTimeout(() => {
      state.filters.query = value;
      renderProducts();
    }, 140);
  });

  $('resetFilters').addEventListener('click', () => {
    state.filters = { category: 'all', query: '', sort: 'popular' };
    state.wishOnly = false;
    $('searchInput').value = '';
    $('sortSelect').value = 'popular';
    renderCategories();
    refreshWishUI();
    renderProducts();
  });

  $('productGrid').addEventListener('click', (e) => {
    const card = e.target.closest('.product-card');
    if (!card) return;
    const product = store.getProduct(card.dataset.id);
    if (!product) return;
    const action = e.target.closest('[data-action]')?.dataset.action;

    if (action === 'wish') {
      e.stopPropagation();
      const { wishlisted } = store.toggleWishlist(product.id);
      refreshWishUI();
      renderProducts();
      renderProductModal();
      toast(wishlisted ? `${product.name} disimpan ke favorit.` : `${product.name} dihapus dari favorit.`);
    } else if (action === 'tryon') {
      openTryOn(product.id);
    } else if (action === 'add') {
      const size = firstAvailableSize(product);
      const color = product.colors[0]?.name;
      updateCart(addToCart(store.getCart(), product, { size, color, qty: 1 }));
      toast(`${product.name} masuk keranjang.`);
    } else {
      openProduct(product.id);
    }
  });

  $('wishButton').addEventListener('click', () => setWishOnly(!state.wishOnly));
  $('wishFilter').addEventListener('click', () => setWishOnly(!state.wishOnly));
  $('mobileWish').addEventListener('click', () => {
    closeMobileMenu();
    setWishOnly(true);
  });
  $('mobileOrders').addEventListener('click', () => {
    closeMobileMenu();
    openOrders();
  });

  $('pmWish').addEventListener('click', () => {
    const p = state.product;
    if (!p) return;
    const { wishlisted } = store.toggleWishlist(p.id);
    refreshWishUI();
    renderProducts();
    toast(wishlisted ? `${p.name} disimpan ke favorit.` : `${p.name} dihapus dari favorit.`);
  });

  // Customer orders & checkout success
  $('ordersButton').addEventListener('click', openOrders);
  $('ordersList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-reorder]');
    if (!btn) return;
    const order = store.getOrders().find((o) => o.id === btn.dataset.reorder);
    if (!order) return;
    let added = 0;
    let cart = store.getCart();
    for (const item of order.items || []) {
      const product = store.getProduct(item.productId);
      if (!product) continue;
      cart = addToCart(cart, product, { size: item.size, color: item.color, qty: item.qty });
      added += 1;
    }
    updateCart(cart);
    closeModal('ordersModal');
    openCart();
    toast(added ? `${added} item dimasukkan lagi ke keranjang.` : 'Produk sudah tidak tersedia.', added ? 'success' : 'error');
  });
  $('successTrack').addEventListener('click', () => {
    closeModal('successModal');
    openOrders();
  });

  // Mobile navigation
  $('navToggle').addEventListener('click', () => {
    const menu = $('mobileMenu');
    const open = menu.hidden;
    menu.hidden = !open;
    $('navToggle').setAttribute('aria-expanded', String(open));
  });
  document.querySelectorAll('.mobile-link[href^="#"]').forEach((link) => {
    link.addEventListener('click', closeMobileMenu);
  });

  // Product modal
  $('pmColors').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-thumb]');
    if (!btn) return;
    state.color = btn.dataset.thumb;
    renderProductModal();
  });

  $('pmSwatches').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-color]');
    if (!btn) return;
    state.color = btn.dataset.color;
    renderProductModal();
  });

  $('pmSizes').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-size]');
    if (!btn || btn.disabled) return;
    state.size = btn.dataset.size;
    renderProductModal();
  });

  $('pmTryOn').addEventListener('click', () => {
    const p = state.product;
    closeModal('productModal');
    if (p) openTryOn(p.id, { color: state.color, size: state.size });
  });

  $('pmAddCart').addEventListener('click', () => {
    const p = state.product;
    if (!p) return;
    updateCart(addToCart(store.getCart(), p, { size: state.size, color: state.color, qty: 1 }));
    toast(`${p.name} (${state.size}) masuk keranjang.`);
    closeModal('productModal');
  });

  $('sizeHelperToggle').addEventListener('click', () => {
    const form = $('sizeHelperForm');
    form.hidden = !form.hidden;
  });

  $('sizeHelperForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const input = {
      height: Number(data.get('height')) || 0,
      weight: Number(data.get('weight')) || 0,
      chest: Number(data.get('chest')) || 0,
      fit: data.get('fit') || 'regular',
    };
    const size = recommendSize(input);
    const p = state.product;
    state.size = size;
    renderProductModal();
    $('sizeHelperResult').textContent = `Rekomendasi: ${size} · keyakinan ${sizeConfidence(input)}% — ukuran otomatis dipilih.`;
  });

  // AR modal controls
  document.querySelector('.ar-mode').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-mode]');
    if (!btn) return;
    switchArMode(btn.dataset.mode);
  });

  $('arSwatches').addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-ar-color]');
    if (!btn) return;
    state.arColor = btn.dataset.arColor;
    $('arColorName').textContent = state.arColor;
    document.querySelectorAll('#arSwatches .swatch').forEach((s) => s.classList.toggle('active', s === btn));
    await applyArGarment();
  });

  $('arSizes').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-ar-size]');
    if (!btn) return;
    state.arSize = btn.dataset.arSize;
    $('arSizeName').textContent = state.arSize;
    document.querySelectorAll('#arSizes .size-btn').forEach((s) => s.classList.toggle('active', s === btn));
  });

  $('arScale').addEventListener('input', (e) => {
    const value = Number(e.target.value);
    ar?.setScale(value);
    $('arScaleVal').textContent = `${value.toFixed(2)}×`;
  });

  $('arOffset').addEventListener('input', (e) => {
    const value = Number(e.target.value);
    ar?.setOffsetY(value);
    $('arOffsetVal').textContent = `${Math.round(value * 100)}%`;
  });

  $('arOpacity').addEventListener('input', (e) => {
    const value = Number(e.target.value);
    ar?.setOpacity(value);
    $('arOpacityVal').textContent = `${Math.round(value * 100)}%`;
  });

  $('arShot').addEventListener('click', () => {
    const dataUrl = ar?.screenshot();
    if (!dataUrl) {
      toast('Screenshot belum siap, coba lagi sebentar.', 'error');
      return;
    }
    $('shotImage').src = dataUrl;
    $('shotDownload').href = dataUrl;
    openModal('shotModal');
  });

  $('arFlip').addEventListener('click', async () => {
    if (!ar?.stream) {
      toast('Nyalakan mode Kamera AR dulu untuk mengganti kamera.', 'error');
      return;
    }
    $('arStatus').textContent = 'Mengganti kamera…';
    await ar.flipCamera();
    updateArModeUI();
  });

  $('arReset').addEventListener('click', () => {
    $('arScale').value = '1';
    $('arOffset').value = '0';
    $('arOpacity').value = '1';
    $('arScaleVal').textContent = '1.00×';
    $('arOffsetVal').textContent = '0%';
    $('arOpacityVal').textContent = '100%';
    ar?.setScale(1);
    ar?.setOffsetY(0);
    ar?.setOpacity(1);
    toast('Tampilan AR direset.');
  });

  $('arAddCart').addEventListener('click', () => {
    const p = state.arProduct;
    if (!p) return;
    updateCart(addToCart(store.getCart(), p, { size: state.arSize, color: state.arColor, qty: 1 }));
    toast(`${p.name} (${state.arSize}) masuk keranjang.`);
  });

  // Cart drawer
  $('cartButton').addEventListener('click', openCart);

  $('cartItems').addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-remove]');
    if (removeBtn) {
      updateCart(removeFromCart(store.getCart(), removeBtn.dataset.remove));
      return;
    }
    const qtyBtn = e.target.closest('[data-qty]');
    if (qtyBtn) {
      const key = qtyBtn.dataset.key;
      const delta = Number(qtyBtn.dataset.qty);
      const item = store.getCart().items.find((i) => i.key === key);
      if (item) updateCart(setQty(store.getCart(), key, item.qty + delta));
    }
  });

  $('applyPromo').addEventListener('click', () => {
    const code = $('promoInput').value.trim();
    const summary = summarizeCart(store.getCart(), code);
    if (code && !summary.promo) {
      toast('Kode promo tidak dikenal.', 'error');
      return;
    }
    state.promo = code;
    store.setPromo(code);
    renderCart();
    toast(summary.promo ? `${summary.promo.label} diterapkan.` : 'Kode promo dihapus.');
  });

  $('checkoutForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const cart = store.getCart();
    if (!cart.items.length) {
      toast('Keranjang masih kosong.', 'error');
      return;
    }
    const data = new FormData(e.target);
    try {
      const order = store.checkout({
        customer: String(data.get('customer') || 'Pelanggan Matahari'),
        city: String(data.get('city') || 'Jakarta'),
        items: cart.items,
        promo: state.promo,
      });
      state.promo = '';
      store.setPromo('');
      e.target.reset();
      renderCart();
      refreshStats();
      closeCart();
      showSuccess(order);
    } catch (err) {
      toast(err.message || 'Checkout gagal.', 'error');
    }
  });

  // Quick size calculator
  $('quickSizeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const input = {
      height: Number(data.get('height')) || 0,
      weight: Number(data.get('weight')) || 0,
      chest: Number(data.get('chest')) || 0,
      fit: 'regular',
    };
    if (!input.height && !input.weight && !input.chest) {
      $('quickSizeResult').hidden = false;
      $('quickSizeResult').textContent = 'Isi minimal satu ukuran tubuh untuk menghitung.';
      return;
    }
    const size = recommendSize(input);
    const confidence = sizeConfidence(input);
    $('quickSizeResult').hidden = false;
    $('quickSizeResult').innerHTML = `Rekomendasi ukuranmu: <b>${size}</b> · keyakinan ${confidence}%. <br />Ukuran ini otomatis dipakai saat kamu membuka produk.`;
  });

  // Generic modal close
  document.addEventListener('click', (e) => {
    const closer = e.target.closest('[data-close]');
    if (!closer) return;
    const id = closer.dataset.close;
    if (id === 'cartDrawer') {
      closeCart();
    } else {
      closeModal(id);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const openModalEl = document.querySelector('.modal.open');
    if (openModalEl) closeModal(openModalEl.id);
    if ($('cartDrawer').classList.contains('open')) closeCart();
  });

  window.addEventListener('scroll', () => {
    $('siteHeader').classList.toggle('scrolled', window.scrollY > 12);
  }, { passive: true });

  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) window.location.reload();
  });
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

function boot() {
  renderCategories();
  renderProducts();
  renderCart();
  refreshStats();
  refreshWishUI();
  bindEvents();
  updateArModeUI();

  $('heroGarmentA').src = garmentDataUrl('hoodie', '#3b3d44');
  $('heroGarmentB').src = garmentDataUrl('tshirt', '#9caf88');
  $('heroGarmentC').src = garmentDataUrl('kemeja', '#efe3cc');

  const demo = store.getProducts()[0];
  if (demo) {
    state.product = demo;
    state.color = demo.colors[0].name;
    state.size = firstAvailableSize(demo);
  }

  // Debug hook for smoke tests.
  window.__matahari = {
    store,
    state,
    openProduct,
    openTryOn,
    openModal,
    closeModal,
    renderCart,
    updateCart,
    openOrders,
    renderOrders,
    setWishOnly,
    toggleWishlist: (id) => {
      const result = store.toggleWishlist(id);
      refreshWishUI();
      renderProducts();
      return result;
    },
    addToCart: (id, opts) => {
      const p = store.getProduct(id);
      return updateCart(addToCart(store.getCart(), p, opts));
    },
    getAr: () => ar,
    getState: () => store.getState(),
    setFilters: (filters) => {
      state.filters = { ...state.filters, ...filters };
      renderCategories();
      renderProducts();
    },
  };

  console.info('Matahari AR Try-On siap.');
}

boot();
