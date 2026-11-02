import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, ordersToCSV, productsToCSV, toCSV } from '../src/csv.js';

test('csvCell escapes commas, quotes and newlines', () => {
  assert.equal(csvCell('plain'), 'plain');
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell('line\nbreak'), '"line\nbreak"');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(undefined), '');
});

test('toCSV writes header and rows separated by CRLF', () => {
  const text = toCSV(['A', 'B'], [[1, 'x,y'], [2, 'z']]);
  assert.equal(text, 'A,B\r\n1,"x,y"\r\n2,z');
});

test('ordersToCSV includes order fields and localized status', () => {
  const csv = ordersToCSV([
    {
      id: 'ORD-1043',
      createdAt: '2026-11-02T10:00:00Z',
      customer: 'Sari',
      city: 'Bandung',
      status: 'paid',
      items: [{ name: 'Kaos', size: 'M', color: 'Hitam', qty: 2 }],
      subtotal: 158000,
      discount: 15800,
      shipping: 0,
      total: 142200,
      promo: 'MATAHARI10',
    },
  ]);
  const lines = csv.split('\r\n');
  assert.equal(lines[0], 'Order,Tanggal,Pelanggan,Kota,Status,Item,Subtotal,Diskon,Ongkir,Total,Promo');
  assert.match(lines[1], /^ORD-1043,/);
  assert.match(lines[1], /Dibayar/);
  assert.match(lines[1], /Kaos \(M\/Hitam\) x2/);
  assert.match(lines[1], /,142200,MATAHARI10$/);
});

test('ordersToCSV handles orders without discount fields', () => {
  const csv = ordersToCSV([{ id: 'ORD-1', customer: 'A', status: 'pending', total: 5000, items: [] }]);
  assert.match(csv.split('\r\n')[1], /,5000,0,0,5000,$/);
});

test('productsToCSV exports one row per product with stock columns', () => {
  const csv = productsToCSV([
    {
      id: 'mt-001',
      name: 'Kaos "Oversize"',
      category: 'kaos',
      type: 'tshirt',
      price: 79000,
      originalPrice: 129000,
      rating: 4.8,
      sold: 1240,
      stock: { S: 24, M: 40, L: 32, XL: 18 },
      colors: [
        { name: 'Putih', hex: '#f7f7f2' },
        { name: 'Hitam', hex: '#24252a' },
      ],
      ar: true,
    },
  ]);
  const lines = csv.split('\r\n');
  assert.match(lines[0], /Stok S,Stok M,Stok L,Stok XL/);
  assert.match(lines[1], /"Kaos ""Oversize"""/);
  assert.match(lines[1], /24,40,32,18/);
  assert.match(lines[1], /"Putih:#f7f7f2; Hitam:#24252a",Ya$/);
});
