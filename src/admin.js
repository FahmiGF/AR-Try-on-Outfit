import { CATEGORIES, SIZES, createProductDraft, formatIDR, isLowStock, totalStock } from './catalog.js';
import { GARMENT_TYPES, garmentDataUrl } from './garments.js';
import { computeDashboard, dayKey, lastNDays } from './analytics.js';
import { browserStorage, createStore, STORAGE_KEY } from './store.js';

const $ = (id) => document.getElementById(id);
const ADMIN_PIN = '2468';
const AUTH_KEY = 'matahari-admin-auth';

let sessionStorageSafe;
try {
  sessionStorageSafe = typeof sessionStorage !== 'undefined' ? sessionStorage : null;
} catch {
  sessionStorageSafe = null;
}

const store = createStore(browserStorage());

const ui = {
  view: 'overview',
  orderFilter: 'all',
  productQuery: '',
  productCategory: 'all',
  editingId: null,
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toast(message, type = 'success') {
  const stack = $('adminToast');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity .2s ease, transform .2s ease';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 220);
  }, 2500);
}

function fmtDate(value) {
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(value) {
  return new Date(value).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function parseColors(text) {
  const out = [];
  for (const line of String(text).split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [name, hex] = trimmed.split(':');
    if (!name) continue;
    out.push({ name: name.trim(), hex: (hex || '#24252a').trim() });
  }
  return out.length ? out : [{ name: 'Hitam', hex: '#24252a' }];
}

function nextProductId() {
  const ids = store
    .getProducts()
    .map((p) => Number(String(p.id).replace(/\D/g, '')))
    .filter((n) => Number.isFinite(n));
  return `mt-${String((ids.length ? Math.max(...ids) : 0) + 1).padStart(3, '0')}`;
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

const VIEW_TITLES = {
  overview: 'Ringkasan',
  products: 'Produk',
  orders: 'Pesanan',
  tryon: 'Analitik Try-On',
};

function switchView(view) {
  ui.view = view;
  document.querySelectorAll('.side-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.view === view);
  });
  document.querySelectorAll('.view').forEach((section) => {
    section.classList.toggle('active', section.id === `view-${view}`);
  });
  $('viewTitle').textContent = VIEW_TITLES[view] || 'Ringkasan';
  $('sidebar').classList.remove('open');
  if (view === 'overview') renderOverview();
  if (view === 'products') renderProductsTable();
  if (view === 'orders') renderOrders();
  if (view === 'tryon') renderTryOnView();
}

/* ------------------------------------------------------------------ */
/* Charts                                                              */
/* ------------------------------------------------------------------ */

function prepareCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(320, Math.round(rect.width || canvas.parentElement.clientWidth || 640));
  const height = Number(canvas.getAttribute('height')) || 240;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, width, height };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {string[]} labels
 * @param {{name:string,color:string,values:number[],fill?:boolean}[]} series
 */
function drawLineChart(canvas, labels, series) {
  if (!canvas) return;
  const { ctx, width, height } = prepareCanvas(canvas);
  ctx.clearRect(0, 0, width, height);

  const pad = { top: 16, right: 28, bottom: 30, left: 38 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const all = series.flatMap((s) => s.values);
  const max = Math.max(1, ...all);
  const niceMax = Math.ceil(max / 5) * 5 || 5;

  ctx.font = '10px Plus Jakarta Sans, system-ui, sans-serif';
  ctx.fillStyle = '#9a8b90';
  ctx.strokeStyle = 'rgba(27,17,21,0.07)';
  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (plotH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
    const value = Math.round((niceMax / 4) * (4 - i));
    ctx.textAlign = 'right';
    ctx.fillText(String(value), pad.left - 8, y + 3);
  }

  ctx.textAlign = 'center';
  labels.forEach((label, i) => {
    const x = pad.left + (plotW / Math.max(1, labels.length - 1)) * i;
    ctx.fillText(label, x, height - 10);
  });

  const xAt = (i) => pad.left + (plotW / Math.max(1, labels.length - 1)) * i;
  const yAt = (v) => pad.top + plotH - (v / niceMax) * plotH;

  for (const s of series) {
    if (s.fill) {
      const grad = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
      grad.addColorStop(0, 'rgba(200,16,46,0.20)');
      grad.addColorStop(1, 'rgba(200,16,46,0)');
      ctx.beginPath();
      s.values.forEach((v, i) => {
        const x = xAt(i);
        const y = yAt(v);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.lineTo(xAt(s.values.length - 1), pad.top + plotH);
      ctx.lineTo(xAt(0), pad.top + plotH);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }

    ctx.beginPath();
    s.values.forEach((v, i) => {
      const x = xAt(i);
      const y = yAt(v);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    s.values.forEach((v, i) => {
      const x = xAt(i);
      const y = yAt(v);
      ctx.beginPath();
      ctx.arc(x, y, 3.4, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = s.color;
      ctx.stroke();
    });
  }
}

function modeSeries(tryons, mode, days = 7) {
  const buckets = lastNDays(days);
  const index = new Map(buckets.map((b) => [b.key, 0]));
  for (const t of tryons) {
    if (t.mode !== mode) continue;
    const key = dayKey(t.ts);
    if (index.has(key)) index.set(key, index.get(key) + 1);
  }
  return { labels: buckets.map((b) => b.label), values: buckets.map((b) => index.get(b.key)) };
}

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

function renderOverview() {
  const s = store.getState();
  const dash = computeDashboard(s.products, s.orders, s.tryons);

  $('kpiRevenue').textContent = formatIDR(dash.revenue);
  $('kpiRevenueSub').textContent = `Hari ini ${formatIDR(dash.revenueToday)} · AOV ${formatIDR(Math.round(dash.averageOrderValue))}`;
  $('kpiOrders').textContent = dash.orderCount.toLocaleString('id-ID');
  $('kpiOrdersSub').textContent = `${dash.pendingOrders} menunggu proses · ${dash.unitsSold} item terjual`;
  $('kpiTryon').textContent = dash.tryOnCount.toLocaleString('id-ID');
  $('kpiTryonSub').textContent = `${dash.tryOnsToday} hari ini · ${dash.activeTryOnProducts} produk dicoba`;
  $('kpiConversion').textContent = `${dash.conversion.toFixed(1)}%`;

  // Chart: try-on vs orders.
  const orders = dash.tryOnSeries.map((bucket) => {
    return s.orders.filter((o) => dayKey(o.createdAt) === bucket.key).length;
  });
  drawLineChart($('tryonChart'), dash.tryOnSeries.map((b) => b.label), [
    { name: 'Try-on', color: '#c8102e', values: dash.tryOnSeries.map((b) => b.value), fill: true },
    { name: 'Pesanan', color: '#e8b04b', values: orders },
  ]);

  renderStatusList(dash.status);
  renderTopProducts($('topProducts'), dash.topProducts);
  renderLowStock(dash.lowStock);
}

function renderStatusList(status) {
  const colors = {
    pending: '#e8b04b',
    paid: '#3b6fd4',
    shipped: '#824abe',
    completed: '#1f8a5b',
    cancelled: '#c0392b',
  };
  const labels = {
    pending: 'Menunggu',
    paid: 'Dibayar',
    shipped: 'Dikirim',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
  };
  const total = Object.values(status).reduce((a, b) => a + b, 0) || 1;

  $('statusList').innerHTML = Object.entries(status)
    .map(([key, count]) => {
      const pct = Math.round((count / total) * 100);
      return `
        <div class="status-row-wrap">
          <div class="status-row">
            <span class="status-dot" style="background:${colors[key] || '#999'}"></span>
            <span class="status-name">${labels[key] || key}</span>
            <span class="status-count" style="color:${colors[key] || '#999'}">${count}</span>
          </div>
          <div class="status-bar"><i style="width:${pct}%;background:${colors[key] || '#999'}"></i></div>
        </div>`;
    })
    .join('');
}

function renderTopProducts(target, products) {
  if (!products.length) {
    target.innerHTML = '<p class="muted-empty">Belum ada sesi try-on.</p>';
    return;
  }
  const max = Math.max(1, ...products.map((p) => p.tries));
  target.innerHTML = products
    .map(
      (entry, i) => `
      <div class="top-product">
        <span class="top-rank">${String(i + 1).padStart(2, '0')}</span>
        <span class="tp-media"><img src="${garmentDataUrl(entry.product.type, entry.product.colors[0]?.hex)}" alt="" /></span>
        <div class="tp-info">
          <div class="tp-name">${esc(entry.product.name)}</div>
          <div class="tp-meta">${entry.tries} try-on · ${entry.sold.toLocaleString('id-ID')} terjual</div>
          <div class="tp-bar"><i style="width:${Math.round((entry.tries / max) * 100)}%"></i></div>
        </div>
        <span class="tp-value">${entry.tries}×</span>
      </div>`,
    )
    .join('');
}

function renderLowStock(lowStock) {
  if (!lowStock.length) {
    $('lowStockList').innerHTML = '<p class="muted-empty">Semua stok dalam kondisi aman.</p>';
    return;
  }
  $('lowStockList').innerHTML = lowStock
    .map((item) => {
      const lowSizes = Object.entries(item.stock || {})
        .filter(([, qty]) => Number(qty) <= 8)
        .map(([size, qty]) => `${size} ${qty}`);
      const out = item.total <= 0;
      return `
        <div class="low-row">
          <span class="low-dot" style="background:${out ? '#c0392b' : '#d78227'}"></span>
          <span class="low-name">${esc(item.name)}</span>
          <span class="low-tag${out ? ' out' : ''}">${out ? 'Habis' : lowSizes.join(' · ')}</span>
        </div>`;
    })
    .join('');
}

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

function renderCategoryFilter() {
  const select = $('productCategoryFilter');
  select.innerHTML =
    '<option value="all">Semua kategori</option>' +
    CATEGORIES.filter((c) => c.id !== 'all')
      .map((c) => `<option value="${c.id}">${esc(c.label)}</option>`)
      .join('');
  select.value = ui.productCategory;
}

function filteredProducts() {
  const q = ui.productQuery.trim().toLowerCase();
  return store.getProducts().filter((p) => {
    const matchCat = ui.productCategory === 'all' || p.category === ui.productCategory;
    const matchQ = !q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    return matchCat && matchQ;
  });
}

function renderProductsTable() {
  const products = filteredProducts();
  const all = store.getProducts();
  const tbody = $('productsTable').querySelector('tbody');

  $('productSummary').textContent = `${all.length} produk · ${all.reduce((sum, p) => sum + totalStock(p), 0)} unit stok total.`;
  $('navProductCount').textContent = all.length;

  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="6"><p class="muted-empty">Tidak ada produk yang cocok.</p></td></tr>';
    return;
  }

  tbody.innerHTML = products
    .map((p) => {
      const stock = p.stock || {};
      const pills = SIZES.filter((size) => p.sizes.includes(size) || stock[size])
        .map((size) => {
          const qty = Number(stock[size] || 0);
          const cls = qty <= 0 ? 'out' : qty <= 8 ? 'low' : '';
          return `<span class="stock-pill ${cls}">${size} ${qty}</span>`;
        })
        .join('');
      const low = isLowStock(p, 8);
      return `
        <tr>
          <td>
            <div class="cell-product">
              <span class="tp-media"><img src="${garmentDataUrl(p.type, p.colors[0]?.hex)}" alt="" /></span>
              <div>
                <div class="cell-name">${esc(p.name)}</div>
                <div class="cell-sub">${p.colors.length} warna · ${p.badge ? esc(p.badge) : 'Tanpa badge'}${low ? ' · stok rendah' : ''}</div>
              </div>
            </div>
          </td>
          <td>${esc(CATEGORIES.find((c) => c.id === p.category)?.label || p.category)}</td>
          <td><b>${formatIDR(p.price)}</b></td>
          <td><div class="stock-pills">${pills || '<span class="stock-pill out">0</span>'}</div></td>
          <td>${p.sold.toLocaleString('id-ID')}</td>
          <td>
            <div class="row-actions">
              <button class="mini-btn" data-edit="${p.id}">Edit</button>
              <button class="mini-btn danger" data-delete="${p.id}">Hapus</button>
            </div>
          </td>
        </tr>`;
    })
    .join('');
}

/* ------------------------------------------------------------------ */
/* Product editor                                                      */
/* ------------------------------------------------------------------ */

function populateEditorSelects() {
  $('editorCategory').innerHTML = CATEGORIES.filter((c) => c.id !== 'all')
    .map((c) => `<option value="${c.id}">${esc(c.label)}</option>`)
    .join('');
  $('editorType').innerHTML = GARMENT_TYPES.map((t) => `<option value="${t}">${esc(t)}</option>`).join('');
}

function renderStockEditor(stock = {}) {
  const wrap = $('stockEditor');
  wrap.innerHTML = SIZES.map(
    (size) => `
      <label class="stock-field">
        <span>${size}</span>
        <input type="number" min="0" max="999" name="stock_${size}" value="${Number(stock[size] || 0)}" />
      </label>`,
  ).join('');
  updateStockTotal();
}

function updateStockTotal() {
  const total = SIZES.reduce((sum, size) => {
    const input = document.querySelector(`[name="stock_${size}"]`);
    return sum + Number(input?.value || 0);
  }, 0);
  $('editorStockTotal').textContent = `Total ${total} unit`;
}

function openEditor(product = null) {
  const form = $('productForm');
  form.reset();
  populateEditorSelects();

  const draft = product || { ...createProductDraft(), id: nextProductId() };
  ui.editingId = product?.id || null;

  $('editorTitle').textContent = product ? 'Edit produk' : 'Tambah produk';
  form.elements.name.value = draft.name || '';
  form.elements.category.value = draft.category || 'kaos';
  form.elements.type.value = draft.type || 'tshirt';
  form.elements.price.value = draft.price || '';
  form.elements.originalPrice.value = draft.originalPrice || '';
  form.elements.badge.value = draft.badge || '';
  form.elements.rating.value = draft.rating || '';
  form.elements.description.value = draft.description || '';
  form.elements.colors.value = (draft.colors || []).map((c) => `${c.name}:${c.hex}`).join('\n');
  form.elements.ar.checked = draft.ar !== false;
  form.dataset.productId = draft.id;
  form.dataset.sold = String(draft.sold || 0);

  renderStockEditor(draft.stock);
  $('productEditor').classList.add('open');
  $('productEditor').setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeEditor() {
  $('productEditor').classList.remove('open');
  $('productEditor').setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function saveProduct(event) {
  event.preventDefault();
  const form = $('productForm');
  const data = new FormData(form);

  const stock = {};
  for (const size of SIZES) stock[size] = Math.max(0, Number(data.get(`stock_${size}`)) || 0);
  const sizes = SIZES.filter((size) => stock[size] > 0);
  if (!sizes.length) sizes.push('M');

  const product = {
    id: form.dataset.productId,
    name: String(data.get('name') || '').trim(),
    category: String(data.get('category') || 'kaos'),
    type: String(data.get('type') || 'tshirt'),
    price: Math.max(0, Number(data.get('price')) || 0),
    originalPrice: Math.max(0, Number(data.get('originalPrice')) || 0),
    colors: parseColors(data.get('colors')),
    sizes,
    stock,
    rating: Math.min(5, Math.max(0, Number(data.get('rating')) || 0)),
    sold: Number(form.dataset.sold) || 0,
    badge: String(data.get('badge') || '').trim() || null,
    description: String(data.get('description') || '').trim(),
    ar: data.get('ar') === 'on',
  };

  if (!product.name) {
    toast('Nama produk wajib diisi.', 'error');
    return;
  }

  store.upsertProduct(product);
  closeEditor();
  renderAll();
  toast(`${ui.editingId ? 'Produk diperbarui' : 'Produk ditambahkan'}: ${product.name}`);
}

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

const STATUS_LABELS = {
  pending: 'Menunggu',
  paid: 'Dibayar',
  shipped: 'Dikirim',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

function renderOrders() {
  const orders = store.getOrders();
  const filtered = ui.orderFilter === 'all' ? orders : orders.filter((o) => o.status === ui.orderFilter);
  const tbody = $('ordersTable').querySelector('tbody');

  $('orderSummary').textContent = `${orders.length} pesanan · ${orders.filter((o) => o.status === 'pending').length} menunggu proses.`;
  $('navOrderCount').textContent = orders.filter((o) => o.status === 'pending').length;

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="6"><p class="muted-empty">Tidak ada pesanan pada filter ini.</p></td></tr>';
    return;
  }

  tbody.innerHTML = filtered
    .map((order) => {
      const itemCount = order.items.reduce((sum, i) => sum + Number(i.qty || 0), 0);
      const first = order.items[0];
      return `
        <tr>
          <td><b>${esc(order.id)}</b><div class="cell-sub">${esc(order.channel || 'Web')}</div></td>
          <td><div class="cell-name">${esc(order.customer)}</div><div class="cell-sub">${esc(order.city || '-')}</div></td>
          <td>
            <div class="cell-name">${esc(first?.name || '-')}</div>
            <div class="cell-sub">${itemCount} item${order.items.length > 1 ? ` · +${order.items.length - 1} produk` : ''}</div>
          </td>
          <td><b>${formatIDR(order.total)}</b></td>
          <td><div class="cell-sub">${fmtDate(order.createdAt)}</div></td>
          <td>
            <select class="status-select" data-order="${esc(order.id)}" style="color:${statusColor(order.status)}">
              ${Object.entries(STATUS_LABELS)
                .map(([value, label]) => `<option value="${value}"${order.status === value ? ' selected' : ''}>${label}</option>`)
                .join('')}
            </select>
          </td>
        </tr>`;
    })
    .join('');
}

function statusColor(status) {
  return {
    pending: '#a2720f',
    paid: '#3b6fd4',
    shipped: '#6e3fae',
    completed: '#1f8a5b',
    cancelled: '#c0392b',
  }[status] || '#4c3d43';
}

/* ------------------------------------------------------------------ */
/* Try-on view                                                         */
/* ------------------------------------------------------------------ */

function renderTryOnView() {
  const s = store.getState();
  const dash = computeDashboard(s.products, s.orders, s.tryons);

  const ar = modeSeries(s.tryons, 'ar');
  const mannequin = modeSeries(s.tryons, 'mannequin');
  drawLineChart($('tryonChartLarge'), ar.labels, [
    { name: 'AR', color: '#c8102e', values: ar.values, fill: true },
    { name: 'Mannequin', color: '#e8b04b', values: mannequin.values },
  ]);

  renderTopProducts($('topProductsLarge'), dash.topProducts);

  const log = [...s.tryons].sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 20);
  const tbody = $('tryonTable').querySelector('tbody');
  tbody.innerHTML = log.length
    ? log
        .map((entry) => {
          const product = s.products.find((p) => p.id === entry.productId);
          return `
            <tr>
              <td>${fmtTime(entry.ts)}</td>
              <td>${esc(product?.name || entry.productId)}</td>
              <td><span class="mode-badge ${entry.mode === 'ar' ? 'ar' : ''}">${entry.mode}</span></td>
              <td><span class="cell-sub">${esc(entry.id)}</span></td>
            </tr>`;
        })
        .join('')
    : '<tr><td colspan="4"><p class="muted-empty">Belum ada sesi try-on.</p></td></tr>';
}

/* ------------------------------------------------------------------ */
/* Global render                                                       */
/* ------------------------------------------------------------------ */

function renderAll() {
  renderOverview();
  renderProductsTable();
  renderOrders();
  renderTryOnView();
  $('navProductCount').textContent = store.getProducts().length;
  $('navOrderCount').textContent = store.getOrders().filter((o) => o.status === 'pending').length;
}

/* ------------------------------------------------------------------ */
/* Events                                                              */
/* ------------------------------------------------------------------ */

function bindEvents() {
  $('loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const pin = $('pinInput').value.trim();
    if (pin === ADMIN_PIN) {
      try {
        sessionStorageSafe?.setItem(AUTH_KEY, '1');
      } catch {
        /* ignore */
      }
      enterDashboard();
    } else {
      $('pinError').hidden = false;
      const card = document.querySelector('.login-card');
      card.classList.remove('shake');
      void card.offsetWidth;
      card.classList.add('shake');
      $('pinInput').value = '';
      $('pinInput').focus();
    }
  });

  document.querySelectorAll('.side-link').forEach((link) => {
    link.addEventListener('click', () => switchView(link.dataset.view));
  });

  document.querySelectorAll('[data-goto]').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.goto));
  });

  $('hamburger').addEventListener('click', () => $('sidebar').classList.toggle('open'));

  $('addProductBtn').addEventListener('click', () => openEditor());

  $('productSearch').addEventListener('input', (e) => {
    ui.productQuery = e.target.value;
    renderProductsTable();
  });

  $('productCategoryFilter').addEventListener('change', (e) => {
    ui.productCategory = e.target.value;
    renderProductsTable();
  });

  $('productsTable').addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-edit]');
    if (editBtn) {
      const product = store.getProduct(editBtn.dataset.edit);
      if (product) openEditor(product);
      return;
    }
    const deleteBtn = e.target.closest('[data-delete]');
    if (deleteBtn) {
      const product = store.getProduct(deleteBtn.dataset.delete);
      if (!product) return;
      if (window.confirm(`Hapus produk "${product.name}"?`)) {
        store.deleteProduct(product.id);
        renderAll();
        toast('Produk dihapus.');
      }
    }
  });

  $('productForm').addEventListener('submit', saveProduct);
  $('productForm').addEventListener('input', (e) => {
    if (e.target.name?.startsWith('stock_')) updateStockTotal();
  });

  $('orderFilters').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-status]');
    if (!btn) return;
    ui.orderFilter = btn.dataset.status;
    document.querySelectorAll('.filter-chip').forEach((chip) => chip.classList.toggle('active', chip === btn));
    renderOrders();
  });

  $('ordersTable').addEventListener('change', (e) => {
    const select = e.target.closest('[data-order]');
    if (!select) return;
    store.updateOrderStatus(select.dataset.order, select.value);
    select.style.color = statusColor(select.value);
    renderOrders();
    renderOverview();
    toast(`Status ${select.dataset.order} → ${STATUS_LABELS[select.value]}.`);
  });

  $('resetDemo').addEventListener('click', () => {
    if (!window.confirm('Reset seluruh data demo ke kondisi awal?')) return;
    store.resetDemo();
    renderAll();
    toast('Data demo dikembalikan ke kondisi awal.');
  });

  $('logoutBtn').addEventListener('click', () => {
    try {
      sessionStorageSafe?.removeItem(AUTH_KEY);
    } catch {
      /* ignore */
    }
    window.location.reload();
  });

  document.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      closeEditor();
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeEditor();
  });

  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) window.location.reload();
  });
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

function enterDashboard() {
  $('loginScreen').hidden = true;
  $('dashboard').hidden = false;
  $('dateChip').textContent = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  renderCategoryFilter();
  renderAll();
  switchView('overview');
}

function boot() {
  bindEvents();
  let authed = false;
  try {
    authed = sessionStorageSafe?.getItem(AUTH_KEY) === '1';
  } catch {
    authed = false;
  }
  if (authed) enterDashboard();

  window.__matahariAdmin = {
    store,
    enterDashboard,
    openEditor,
    switchView,
    ui,
    get dash() {
      const s = store.getState();
      return computeDashboard(s.products, s.orders, s.tryons);
    },
  };
}

boot();
