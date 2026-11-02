/**
 * Analitik admin: KPI, tren try-on 7 hari, produk terpopuler.
 * Semua fungsi murni agar mudah diuji.
 */

import { isLowStock, totalStock } from './catalog.js';

export const DAY_MS = 24 * 60 * 60 * 1000;

export function dayKey(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function lastNDays(n = 7, now = Date.now()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now - i * DAY_MS);
    out.push({ key: dayKey(d), date: d, label: d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) });
  }
  return out;
}

export function tryOnSeries(tryons, now = Date.now(), days = 7) {
  const buckets = lastNDays(days, now);
  const index = new Map(buckets.map((b) => [b.key, 0]));
  for (const entry of tryons || []) {
    const key = dayKey(entry.ts || entry.at || now);
    if (index.has(key)) index.set(key, index.get(key) + 1);
  }
  return buckets.map((b) => ({ label: b.label, key: b.key, value: index.get(b.key) }));
}

export function revenueSeries(orders, now = Date.now(), days = 7) {
  const buckets = lastNDays(days, now);
  const index = new Map(buckets.map((b) => [b.key, 0]));
  for (const order of orders || []) {
    if (order.status === 'cancelled' || order.status === 'refunded') continue;
    const key = dayKey(order.createdAt || now);
    if (index.has(key)) index.set(key, index.get(key) + Number(order.total || 0));
  }
  return buckets.map((b) => ({ label: b.label, key: b.key, value: index.get(b.key) }));
}

export function topProducts(products, tryons, limit = 5) {
  const counts = new Map();
  for (const entry of tryons || []) {
    counts.set(entry.productId, (counts.get(entry.productId) || 0) + 1);
  }
  return (products || [])
    .map((product) => ({ product, tries: counts.get(product.id) || 0, sold: product.sold || 0 }))
    .sort((a, b) => b.tries - a.tries || b.sold - a.sold)
    .slice(0, limit);
}

export function ordersByStatus(orders) {
  const base = { pending: 0, paid: 0, shipped: 0, completed: 0, cancelled: 0 };
  for (const order of orders || []) {
    if (base[order.status] === undefined) base[order.status] = 0;
    base[order.status] += 1;
  }
  return base;
}

export function computeDashboard(products, orders, tryons, now = Date.now(), days = 7) {
  const safeOrders = orders || [];
  const safeTryons = tryons || [];
  const paidOrders = safeOrders.filter((o) => o.status !== 'cancelled' && o.status !== 'refunded');
  const revenue = paidOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
  const unitsSold = paidOrders.reduce(
    (sum, o) => sum + (o.items || []).reduce((s, i) => s + Number(i.qty || 0), 0),
    0,
  );

  const today = dayKey(now);
  const tryOnsToday = safeTryons.filter((t) => dayKey(t.ts || now) === today).length;
  const revenueToday = paidOrders
    .filter((o) => dayKey(o.createdAt || now) === today)
    .reduce((sum, o) => sum + Number(o.total || 0), 0);

  const conversion = safeTryons.length ? (safeOrders.length / safeTryons.length) * 100 : 0;
  const activeTryOnProducts = new Set(safeTryons.map((t) => t.productId)).size;

  const lowStock = (products || [])
    .filter((p) => isLowStock(p, 8))
    .map((p) => ({ id: p.id, name: p.name, total: totalStock(p), stock: p.stock }));

  return {
    revenue,
    revenueToday,
    orderCount: safeOrders.length,
    pendingOrders: safeOrders.filter((o) => o.status === 'pending').length,
    unitsSold,
    tryOnCount: safeTryons.length,
    tryOnsToday,
    activeTryOnProducts,
    conversion,
    averageOrderValue: paidOrders.length ? revenue / paidOrders.length : 0,
    lowStock,
    status: ordersByStatus(safeOrders),
    tryOnSeries: tryOnSeries(safeTryons, now, days),
    revenueSeries: revenueSeries(safeOrders, now, days),
    topProducts: topProducts(products, safeTryons, 5),
  };
}
