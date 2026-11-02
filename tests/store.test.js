import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEY,
  createSeedState,
  createStore,
} from '../src/store.js';
import { addToCart, emptyCart } from '../src/cart.js';

function fakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
    dump: () => map,
  };
}

const NOW = new Date('2026-11-02T10:00:00Z').getTime();

test('seed state contains products, orders and try-ons', () => {
  const seed = createSeedState(NOW);
  assert.equal(seed.products.length, 8);
  assert.ok(seed.orders.length >= 8);
  assert.ok(seed.tryons.length > 0);
  assert.deepEqual(seed.cart, emptyCart());
});

test('createStore seeds storage on first run', () => {
  const storage = fakeStorage();
  const store = createStore(storage, { now: () => NOW });
  assert.equal(store.getProducts().length, 8);
  assert.ok(storage.getItem(STORAGE_KEY));
});

test('records try-on entries and persists them', () => {
  const storage = fakeStorage();
  const store = createStore(storage, { now: () => NOW });
  const before = store.getTryons().length;
  const entry = store.recordTryOn('mt-001', 'ar');
  assert.equal(store.getTryons().length, before + 1);
  assert.equal(entry.productId, 'mt-001');
  assert.equal(entry.mode, 'ar');
});

test('checkout creates an order, decrements stock and empties cart', () => {
  const storage = fakeStorage();
  const store = createStore(storage, { now: () => NOW });
  const product = store.getProduct('mt-001');
  const startStock = product.stock.M;

  const cart = addToCart(emptyCart(), product, { size: 'M', color: product.colors[0].name, qty: 2 });
  store.setCart(cart);

  const order = store.checkout({ customer: 'Uji', city: 'Bandung', items: cart.items });
  assert.ok(order.id.startsWith('ORD-'));
  assert.equal(order.status, 'pending');
  assert.equal(order.customer, 'Uji');
  assert.equal(store.getCart().items.length, 0);
  assert.equal(store.getProduct('mt-001').stock.M, startStock - 2);
  assert.equal(store.getOrders()[0].id, order.id);
});

test('checkout rejects empty items', () => {
  const store = createStore(fakeStorage(), { now: () => NOW });
  assert.throws(() => store.checkout({ items: [] }), /Keranjang kosong/);
});

test('updateOrderStatus changes status', () => {
  const store = createStore(fakeStorage(), { now: () => NOW });
  const order = store.getOrders()[0];
  store.updateOrderStatus(order.id, 'completed');
  assert.equal(store.getOrders().find((o) => o.id === order.id).status, 'completed');
});

test('upsertProduct adds and updates', () => {
  const store = createStore(fakeStorage(), { now: () => NOW });
  const count = store.getProducts().length;
  const draft = {
    id: 'mt-999',
    name: 'Produk Uji',
    category: 'kaos',
    type: 'tshirt',
    price: 50000,
    originalPrice: 0,
    colors: [{ name: 'Hitam', hex: '#000000' }],
    sizes: ['M'],
    stock: { M: 3 },
    rating: 4,
    sold: 0,
    badge: null,
    description: '',
    ar: true,
  };
  store.upsertProduct(draft);
  assert.equal(store.getProducts().length, count + 1);
  assert.equal(store.getProduct('mt-999').name, 'Produk Uji');

  store.upsertProduct({ ...draft, name: 'Produk Diubah' });
  assert.equal(store.getProducts().length, count + 1);
  assert.equal(store.getProduct('mt-999').name, 'Produk Diubah');
});

test('deleteProduct and adjustStock mutate the catalog', () => {
  const store = createStore(fakeStorage(), { now: () => NOW });
  store.adjustStock('mt-001', 'M', -5);
  const product = store.getProduct('mt-001');
  assert.equal(product.stock.M, Math.max(0, 40 - 5));

  store.adjustStock('mt-001', 'M', -9999);
  assert.equal(store.getProduct('mt-001').stock.M, 0);

  store.deleteProduct('mt-002');
  assert.equal(store.getProduct('mt-002'), null);
});

test('state survives a new store instance on the same storage', () => {
  const storage = fakeStorage();
  const store = createStore(storage, { now: () => NOW });
  store.recordTryOn('mt-003', 'mannequin');
  const tryons = store.getTryons().length;

  const reloaded = createStore(storage, { now: () => NOW });
  assert.equal(reloaded.getTryons().length, tryons);
});

test('subscribe notifies listeners and unsubscribe stops it', () => {
  const store = createStore(fakeStorage(), { now: () => NOW });
  let calls = 0;
  const off = store.subscribe(() => { calls += 1; });
  store.setPromo('MATAHARI10');
  assert.equal(calls, 1);
  off();
  store.setPromo('');
  assert.equal(calls, 1);
});

test('corrupt storage is replaced by a fresh seed', () => {
  const storage = fakeStorage();
  storage.setItem(STORAGE_KEY, '{not json');
  const store = createStore(storage, { now: () => NOW });
  assert.equal(store.getProducts().length, 8);
});

test('resetDemo restores the seed state', () => {
  const store = createStore(fakeStorage(), { now: () => NOW });
  store.deleteProduct('mt-001');
  assert.equal(store.getProducts().length, 7);
  store.resetDemo();
  assert.equal(store.getProducts().length, 8);
});
