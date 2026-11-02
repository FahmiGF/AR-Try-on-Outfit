import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FREE_SHIPPING_MIN,
  SHIPPING_FLAT,
  addToCart,
  cartCount,
  cartSubtotal,
  emptyCart,
  removeFromCart,
  setQty,
  summarizeCart,
} from '../src/cart.js';

const product = {
  id: 'p1',
  name: 'Kaos Uji',
  type: 'tshirt',
  price: 100000,
  colors: [{ name: 'Hitam', hex: '#000000' }, { name: 'Putih', hex: '#ffffff' }],
  sizes: ['S', 'M', 'L'],
  stock: { S: 5, M: 2, L: 0 },
};

test('addToCart adds and merges identical variants', () => {
  let cart = emptyCart();
  cart = addToCart(cart, product, { size: 'S', color: 'Hitam', qty: 1 });
  cart = addToCart(cart, product, { size: 'S', color: 'Hitam', qty: 1 });
  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].qty, 2);
  assert.equal(cartCount(cart), 2);
});

test('addToCart treats different size/color as separate lines', () => {
  let cart = emptyCart();
  cart = addToCart(cart, product, { size: 'S', color: 'Hitam' });
  cart = addToCart(cart, product, { size: 'M', color: 'Putih' });
  assert.equal(cart.items.length, 2);
});

test('addToCart respects available stock', () => {
  let cart = emptyCart();
  cart = addToCart(cart, product, { size: 'M', color: 'Hitam', qty: 10 });
  assert.equal(cart.items[0].qty, 2);
});

test('removeFromCart and setQty update lines', () => {
  let cart = addToCart(emptyCart(), product, { size: 'S', color: 'Hitam' });
  const key = cart.items[0].key;
  cart = setQty(cart, key, 4);
  assert.equal(cart.items[0].qty, 4);
  cart = setQty(cart, key, 0);
  assert.equal(cart.items.length, 0);

  cart = addToCart(emptyCart(), product, { size: 'S', color: 'Hitam' });
  cart = removeFromCart(cart, cart.items[0].key);
  assert.equal(cart.items.length, 0);
});

test('summarizeCart calculates free shipping above threshold', () => {
  let cart = addToCart(emptyCart(), product, { size: 'S', color: 'Hitam', qty: 1 });
  let summary = summarizeCart(cart);
  assert.equal(summary.subtotal, 100000);
  assert.equal(summary.shipping, SHIPPING_FLAT);
  assert.equal(summary.total, 120000);

  cart = addToCart(cart, product, { size: 'M', color: 'Hitam', qty: 2 });
  summary = summarizeCart(cart);
  assert.equal(summary.subtotal, 300000);
  assert.ok(summary.subtotal >= FREE_SHIPPING_MIN);
  assert.equal(summary.shipping, 0);
  assert.equal(summary.total, 300000);
});

test('summarizeCart applies percent, fixed and shipping promos', () => {
  const cart = addToCart(emptyCart(), product, { size: 'S', color: 'Hitam', qty: 1 });

  const percent = summarizeCart(cart, 'MATAHARI10');
  assert.equal(percent.discount, 10000);
  assert.equal(percent.total, 110000);

  const fixed = summarizeCart(cart, 'HEMAT50');
  assert.equal(fixed.discount, 50000);
  assert.equal(fixed.total, 70000);

  const shipping = summarizeCart(cart, 'GRATISONGKIR');
  assert.equal(shipping.shipping, 0);
  assert.equal(shipping.total, 100000);

  const unknown = summarizeCart(cart, 'NOPE');
  assert.equal(unknown.promo, null);
  assert.equal(unknown.discount, 0);
});

test('cartSubtotal handles multiple lines', () => {
  let cart = addToCart(emptyCart(), product, { size: 'S', color: 'Hitam', qty: 2 });
  cart = addToCart(cart, product, { size: 'M', color: 'Hitam', qty: 1 });
  assert.equal(cartSubtotal(cart), 300000);
});
