import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDashboard,
  dayKey,
  lastNDays,
  ordersByStatus,
  revenueSeries,
  topProducts,
  tryOnSeries,
} from '../src/analytics.js';
import { SEED_PRODUCTS } from '../src/catalog.js';

const NOW = new Date('2026-11-02T10:00:00.000Z').getTime();
const DAY = 24 * 60 * 60 * 1000;

const products = SEED_PRODUCTS.map((p) => ({ ...p }));

const orders = [
  { id: 'A', status: 'completed', total: 100000, createdAt: new Date(NOW - 0.2 * DAY).toISOString(), items: [{ qty: 2 }] },
  { id: 'B', status: 'pending', total: 50000, createdAt: new Date(NOW - 1.2 * DAY).toISOString(), items: [{ qty: 1 }] },
  { id: 'C', status: 'cancelled', total: 999000, createdAt: new Date(NOW - 0.4 * DAY).toISOString(), items: [{ qty: 9 }] },
];

const tryons = [
  { id: 'T1', productId: 'mt-001', mode: 'ar', ts: new Date(NOW - 0.1 * DAY).toISOString() },
  { id: 'T2', productId: 'mt-001', mode: 'mannequin', ts: new Date(NOW - 0.2 * DAY).toISOString() },
  { id: 'T3', productId: 'mt-002', mode: 'ar', ts: new Date(NOW - 2.1 * DAY).toISOString() },
  { id: 'T4', productId: 'mt-003', mode: 'ar', ts: new Date(NOW - 80 * DAY).toISOString() },
];

test('dayKey formats local date consistently', () => {
  const key = dayKey(new Date('2026-11-02T08:30:00'));
  assert.equal(key, '2026-11-02');
});

test('lastNDays returns ordered buckets', () => {
  const days = lastNDays(7, NOW);
  assert.equal(days.length, 7);
  assert.equal(days[6].key, dayKey(new Date(NOW)));
  assert.equal(days[0].key, dayKey(new Date(NOW - 6 * DAY)));
});

test('tryOnSeries counts only entries within window', () => {
  const series = tryOnSeries(tryons, NOW, 7);
  assert.equal(series.length, 7);
  const total = series.reduce((sum, s) => sum + s.value, 0);
  assert.equal(total, 3); // 80-day-old entry excluded
  assert.equal(series[6].value, 2);
});

test('revenueSeries ignores cancelled orders', () => {
  const series = revenueSeries(orders, NOW, 7);
  const total = series.reduce((sum, s) => sum + s.value, 0);
  assert.equal(total, 150000);
});

test('topProducts ranks by try-on count then sales', () => {
  const top = topProducts(products, tryons, 3);
  assert.equal(top[0].product.id, 'mt-001');
  assert.equal(top[0].tries, 2);
  assert.equal(top[1].product.id, 'mt-002');
});

test('ordersByStatus counts each status', () => {
  const counts = ordersByStatus(orders);
  assert.equal(counts.completed, 1);
  assert.equal(counts.pending, 1);
  assert.equal(counts.cancelled, 1);
  assert.equal(counts.shipped, 0);
});

test('computeDashboard aggregates KPIs', () => {
  const dash = computeDashboard(products, orders, tryons, NOW);
  assert.equal(dash.revenue, 150000);
  assert.equal(dash.orderCount, 3);
  assert.equal(dash.pendingOrders, 1);
  assert.equal(dash.unitsSold, 3);
  assert.equal(dash.tryOnCount, 4);
  assert.equal(dash.tryOnsToday, 2);
  assert.equal(dash.activeTryOnProducts, 3);
  assert.ok(dash.conversion > 0);
  assert.equal(dash.averageOrderValue, 75000);
  assert.equal(dash.status.completed, 1);
  assert.ok(Array.isArray(dash.lowStock));
  assert.equal(dash.tryOnSeries.length, 7);
  assert.equal(dash.revenueSeries.length, 7);
  assert.equal(dash.topProducts.length, 5);
});

test('computeDashboard handles empty data', () => {
  const dash = computeDashboard([], [], [], NOW);
  assert.equal(dash.revenue, 0);
  assert.equal(dash.tryOnCount, 0);
  assert.equal(dash.conversion, 0);
  assert.equal(dash.averageOrderValue, 0);
  assert.deepEqual(dash.topProducts, []);
});
