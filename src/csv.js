/**
 * Ekspor data admin ke CSV.
 * Fungsi murni supaya formatnya bisa diuji tanpa DOM.
 */

import { SIZES } from './catalog.js';
import { orderStatusLabel } from './orders.js';

export function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r;]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCSV(headers, rows) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function ordersToCSV(orders = []) {
  const headers = ['Order', 'Tanggal', 'Pelanggan', 'Kota', 'Status', 'Item', 'Subtotal', 'Diskon', 'Ongkir', 'Total', 'Promo'];
  const rows = orders.map((order) => {
    const items = (order.items || [])
      .map((item) => `${item.name} (${item.size}/${item.color}) x${item.qty}`)
      .join('; ');
    return [
      order.id,
      order.createdAt,
      order.customer,
      order.city || '',
      orderStatusLabel(order.status),
      items,
      Number(order.subtotal ?? order.total ?? 0),
      Number(order.discount || 0),
      Number(order.shipping || 0),
      Number(order.total || 0),
      order.promo || '',
    ];
  });
  return toCSV(headers, rows);
}

export function productsToCSV(products = []) {
  const headers = ['ID', 'Nama', 'Kategori', 'Tipe', 'Harga', 'Harga Asli', 'Rating', 'Terjual', ...SIZES.map((s) => `Stok ${s}`), 'Warna', 'AR'];
  const rows = products.map((product) => [
    product.id,
    product.name,
    product.category,
    product.type,
    Number(product.price || 0),
    Number(product.originalPrice || 0),
    Number(product.rating || 0),
    Number(product.sold || 0),
    ...SIZES.map((size) => Number(product.stock?.[size] || 0)),
    (product.colors || []).map((c) => `${c.name}:${c.hex}`).join('; '),
    product.ar ? 'Ya' : 'Tidak',
  ]);
  return toCSV(headers, rows);
}
