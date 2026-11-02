import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ORDER_FLOW,
  formatOrderDate,
  orderItemCount,
  orderItemSummary,
  orderProgress,
  orderStatusLabel,
  orderStatusStyle,
} from '../src/orders.js';

const order = {
  items: [
    { name: 'Kaos Oversize', size: 'M', qty: 2 },
    { name: 'Kemeja Linen', size: 'L', qty: 1 },
    { name: 'Hoodie', size: 'XL', qty: 3 },
  ],
};

test('orderStatusLabel and style cover known statuses', () => {
  assert.equal(orderStatusLabel('pending'), 'Menunggu');
  assert.equal(orderStatusLabel('completed'), 'Selesai');
  assert.equal(orderStatusLabel('unknown'), 'unknown');
  assert.equal(orderStatusStyle('paid').color, '#3b6fd4');
  assert.equal(orderStatusStyle('missing').label, 'missing');
});

test('orderProgress marks completed, current and future steps', () => {
  const fresh = orderProgress('pending');
  assert.equal(fresh.length, ORDER_FLOW.length);
  assert.equal(fresh[0].done, true);
  assert.equal(fresh[0].current, true);
  assert.equal(fresh[1].done, false);

  const shipped = orderProgress('shipped');
  assert.deepEqual(
    shipped.map((s) => s.done),
    [true, true, true, false],
  );
  assert.equal(shipped[2].current, true);
});

test('cancelled and refunded orders do not show a normal progress', () => {
  for (const status of ['cancelled', 'refunded']) {
    const steps = orderProgress(status);
    assert.ok(steps.every((s) => s.cancelled && !s.done && !s.current));
  }
});

test('orderItemCount sums quantities', () => {
  assert.equal(orderItemCount(order), 6);
  assert.equal(orderItemCount({}), 0);
});

test('orderItemSummary truncates long item lists', () => {
  assert.equal(orderItemSummary({ items: [] }), '-');
  assert.equal(
    orderItemSummary(order, 2),
    'Kaos Oversize (M) ×2, Kemeja Linen (L) ×1 +1 lainnya',
  );
});

test('formatOrderDate handles valid and invalid dates', () => {
  assert.equal(formatOrderDate('not-a-date'), '-');
  assert.match(formatOrderDate('2026-11-02T10:00:00Z'), /2026/);
});
