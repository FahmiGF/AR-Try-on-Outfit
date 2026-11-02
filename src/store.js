/**
 * Store bersama antara storefront dan admin.
 * Sumber data tunggal di localStorage (fallback ke memori saat SSR/uji).
 */

import { SEED_PRODUCTS } from './catalog.js';
import { emptyCart, summarizeCart } from './cart.js';

export const STORAGE_KEY = 'matahari-ar-tryon:v1';
export const STORE_EVENT = 'matahari:store-change';

const DAY = 24 * 60 * 60 * 1000;

function seedOrders(now = Date.now()) {
  const p = SEED_PRODUCTS;
  const mk = (id, daysAgo, status, items, customer, city, total) => ({
    id,
    createdAt: new Date(now - daysAgo * DAY).toISOString(),
    status,
    customer,
    city,
    items,
    total,
    channel: 'Web',
  });

  return [
    mk('ORD-1042', 0.2, 'pending', [{ productId: p[0].id, name: p[0].name, size: 'L', qty: 2, price: p[0].price }], 'Ayu Lestari', 'Jakarta', 178000),
    mk('ORD-1041', 0.6, 'paid', [{ productId: p[3].id, name: p[3].name, size: 'M', qty: 1, price: p[3].price }], 'Bima Saputra', 'Bandung', 209000),
    mk('ORD-1040', 1.1, 'shipped', [{ productId: p[1].id, name: p[1].name, size: 'L', qty: 1, price: p[1].price }], 'Citra Dewi', 'Surabaya', 179000),
    mk('ORD-1039', 1.8, 'completed', [
      { productId: p[4].id, name: p[4].name, size: 'S', qty: 1, price: p[4].price },
      { productId: p[2].id, name: p[2].name, size: 'M', qty: 1, price: p[2].price },
    ], 'Dian Pratama', 'Yogyakarta', 368000),
    mk('ORD-1038', 2.4, 'completed', [{ productId: p[5].id, name: p[5].name, size: 'XL', qty: 1, price: p[5].price }], 'Eka Nugroho', 'Semarang', 269000),
    mk('ORD-1037', 3.2, 'completed', [{ productId: p[0].id, name: p[0].name, size: 'M', qty: 3, price: p[0].price }], 'Fajar Ramadhan', 'Medan', 257000),
    mk('ORD-1036', 4.1, 'cancelled', [{ productId: p[6].id, name: p[6].name, size: 'L', qty: 1, price: p[6].price }], 'Gita Puspa', 'Bekasi', 189000),
    mk('ORD-1035', 5.0, 'completed', [{ productId: p[7].id, name: p[7].name, size: 'M', qty: 2, price: p[7].price }], 'Hadi Susanto', 'Depok', 298000),
    mk('ORD-1034', 6.3, 'completed', [{ productId: p[3].id, name: p[3].name, size: 'L', qty: 1, price: p[3].price }], 'Indah Permata', 'Tangerang', 209000),
  ];
}

function seedTryons(now = Date.now()) {
  const out = [];
  let n = 0;
  const weights = [26, 13, 19, 17, 10, 8, 7];
  for (let d = 6; d >= 0; d--) {
    const count = weights[6 - d];
    for (let i = 0; i < count; i++) {
      const product = SEED_PRODUCTS[(d + i) % SEED_PRODUCTS.length];
      out.push({
        id: `TRY-${String(++n).padStart(4, '0')}`,
        productId: product.id,
        mode: i % 4 === 0 ? 'mannequin' : 'ar',
        ts: new Date(now - d * DAY + (i / count) * DAY).toISOString(),
      });
    }
  }
  return out;
}

export function createSeedState(now = Date.now()) {
  return {
    version: 1,
    products: SEED_PRODUCTS.map((p) => ({ ...p, stock: { ...p.stock }, colors: p.colors.map((c) => ({ ...c })) })),
    orders: seedOrders(now),
    tryons: seedTryons(now),
    cart: emptyCart(),
    promo: '',
    wishlist: [],
    orderSeq: 1042,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createStore(storage, { now = Date.now, seed = true } = {}) {
  const listeners = new Set();
  let memory = null;

  const read = () => {
    try {
      const raw = storage?.getItem?.(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.products) && Array.isArray(parsed.orders)) {
          return {
            ...parsed,
            tryons: Array.isArray(parsed.tryons) ? parsed.tryons : [],
            wishlist: Array.isArray(parsed.wishlist) ? parsed.wishlist : [],
            cart: parsed.cart && Array.isArray(parsed.cart.items) ? parsed.cart : emptyCart(),
            promo: typeof parsed.promo === 'string' ? parsed.promo : '',
          };
        }
      }
    } catch {
      /* corrupt storage -> reseed */
    }
    return memory || (seed ? createSeedState(now()) : { ...createSeedState(now()), products: [], orders: [], tryons: [] });
  };

  let state = read();

  const persist = () => {
    memory = state;
    try {
      storage?.setItem?.(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* quota / private mode */
    }
    for (const fn of listeners) fn(state);
    try {
      if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
        window.dispatchEvent(new CustomEvent(STORE_EVENT, { detail: state }));
      }
    } catch {
      /* not a browser */
    }
  };

  const api = {
    getState: () => state,
    getProducts: () => state.products,
    getProduct(id) {
      return state.products.find((p) => p.id === id) || null;
    },
    getOrders: () => state.orders.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    getTryons: () => state.tryons,
    getCart: () => state.cart,
    getWishlist: () => state.wishlist || [],
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    setCart(cart) {
      state = { ...state, cart: clone(cart) };
      persist();
      return state.cart;
    },
    setPromo(promo) {
      state = { ...state, promo: String(promo || '') };
      persist();
    },

    toggleWishlist(productId) {
      const current = state.wishlist || [];
      const exists = current.includes(productId);
      const wishlist = exists ? current.filter((id) => id !== productId) : [productId, ...current];
      state = { ...state, wishlist };
      persist();
      return { wishlisted: !exists, wishlist };
    },

    isWishlisted(productId) {
      return (state.wishlist || []).includes(productId);
    },

    recordTryOn(productId, mode = 'ar') {
      const entry = { id: `TRY-${Date.now().toString(36)}`, productId, mode, ts: new Date(now()).toISOString() };
      state = { ...state, tryons: [...state.tryons, entry] };
      persist();
      return entry;
    },

    checkout({ customer = 'Pelanggan Matahari', city = 'Jakarta', items = [], promo = '' } = {}) {
      if (!items.length) throw new Error('Keranjang kosong');
      const nextSeq = (state.orderSeq || 1042) + 1;
      const summary = summarizeCart({ items }, promo);
      const order = {
        id: `ORD-${nextSeq}`,
        createdAt: new Date(now()).toISOString(),
        status: 'pending',
        customer,
        city,
        items: items.map((i) => ({ ...i })),
        subtotal: summary.subtotal,
        discount: summary.discount,
        shipping: summary.shipping,
        total: summary.total,
        promo: promo || '',
        promoLabel: summary.promo?.label || '',
        channel: 'Web',
      };

      const products = state.products.map((product) => {
        const stock = { ...product.stock };
        for (const item of items) {
          if (item.productId !== product.id) continue;
          stock[item.size] = Math.max(0, Number(stock[item.size] || 0) - Number(item.qty || 0));
        }
        return { ...product, stock };
      });

      state = {
        ...state,
        products,
        orders: [order, ...state.orders],
        cart: emptyCart(),
        promo: '',
        orderSeq: nextSeq,
      };
      persist();
      return order;
    },

    updateOrderStatus(orderId, status) {
      state = {
        ...state,
        orders: state.orders.map((o) => (o.id === orderId ? { ...o, status } : o)),
      };
      persist();
    },

    upsertProduct(product) {
      const exists = state.products.some((p) => p.id === product.id);
      const products = exists
        ? state.products.map((p) => (p.id === product.id ? { ...p, ...clone(product) } : p))
        : [{ ...clone(product) }, ...state.products];
      state = { ...state, products };
      persist();
      return product;
    },

    deleteProduct(id) {
      state = { ...state, products: state.products.filter((p) => p.id !== id) };
      persist();
    },

    adjustStock(id, size, delta) {
      state = {
        ...state,
        products: state.products.map((p) =>
          p.id === id ? { ...p, stock: { ...p.stock, [size]: Math.max(0, Number(p.stock?.[size] || 0) + delta) } } : p,
        ),
      };
      persist();
    },

    resetDemo() {
      state = createSeedState(now());
      persist();
      return state;
    },
  };

  persist();
  return api;
}

export function browserStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
