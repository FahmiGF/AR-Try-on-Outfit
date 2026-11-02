import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIES,
  SIZES,
  SEED_PRODUCTS,
  createProductDraft,
  filterProducts,
  formatIDR,
  isLowStock,
  totalStock,
} from '../src/catalog.js';

test('seed catalog has unique ids and complete fields', () => {
  assert.equal(SEED_PRODUCTS.length, 8);
  const ids = new Set(SEED_PRODUCTS.map((p) => p.id));
  assert.equal(ids.size, SEED_PRODUCTS.length);
  for (const product of SEED_PRODUCTS) {
    assert.ok(product.name.length > 0);
    assert.ok(product.price > 0);
    assert.ok(product.colors.length > 0);
    assert.ok(product.sizes.length > 0);
    assert.ok(Object.keys(product.stock).length > 0);
    assert.equal(product.ar, true);
  }
});

test('categories and sizes expose expected ids', () => {
  assert.equal(CATEGORIES[0].id, 'all');
  assert.deepEqual(SIZES, ['S', 'M', 'L', 'XL']);
});

test('filterProducts filters by category and query', () => {
  const kaos = filterProducts(SEED_PRODUCTS, { category: 'kaos' });
  assert.ok(kaos.length >= 1);
  assert.ok(kaos.every((p) => p.category === 'kaos'));

  const hoodie = filterProducts(SEED_PRODUCTS, { query: 'hoodie' });
  assert.ok(hoodie.length >= 1);
  assert.ok(
    hoodie.every(
      (p) =>
        p.name.toLowerCase().includes('hoodie') ||
        p.description.toLowerCase().includes('hoodie') ||
        p.category.toLowerCase().includes('hoodie'),
    ),
  );
});

test('filterProducts sorts by price and rating', () => {
  const asc = filterProducts(SEED_PRODUCTS, { sort: 'price-asc' });
  const desc = filterProducts(SEED_PRODUCTS, { sort: 'price-desc' });
  for (let i = 1; i < asc.length; i++) assert.ok(asc[i - 1].price <= asc[i].price);
  for (let i = 1; i < desc.length; i++) assert.ok(desc[i - 1].price >= desc[i].price);

  const rated = filterProducts(SEED_PRODUCTS, { sort: 'rating' });
  for (let i = 1; i < rated.length; i++) assert.ok(rated[i - 1].rating >= rated[i].rating);
});

test('totalStock and isLowStock reflect stock map', () => {
  const product = { stock: { S: 3, M: 0, L: 12 } };
  assert.equal(totalStock(product), 15);
  assert.equal(isLowStock(product, 8), true);
  assert.equal(isLowStock({ stock: { S: 12, M: 20 } }, 8), false);
});

test('formatIDR formats rupiah', () => {
  assert.equal(formatIDR(129000), 'Rp129.000');
  assert.equal(formatIDR(0), 'Rp0');
});

test('createProductDraft returns a blank product', () => {
  const draft = createProductDraft();
  assert.equal(draft.name, '');
  assert.equal(draft.price, 0);
  assert.deepEqual(draft.sizes, ['S', 'M', 'L', 'XL']);
  assert.ok(draft.id.startsWith('mt-'));
});
