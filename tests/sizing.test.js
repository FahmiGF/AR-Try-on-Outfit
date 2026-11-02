import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SIZE_CHART,
  computeGarmentTransform,
  mannequinTransform,
  recommendSize,
  sizeConfidence,
} from '../src/sizing.js';

function landmarks({ mirror = false } = {}) {
  const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  const lx = mirror ? 0.62 : 0.38;
  const rx = mirror ? 0.38 : 0.62;
  points[11] = { x: lx, y: 0.3, visibility: 0.95 }; // left shoulder
  points[12] = { x: rx, y: 0.3, visibility: 0.95 }; // right shoulder
  points[23] = { x: lx + 0.02, y: 0.58, visibility: 0.92 }; // left hip
  points[24] = { x: rx - 0.02, y: 0.58, visibility: 0.92 }; // right hip
  points[0] = { x: 0.5, y: 0.16, visibility: 0.99 };
  return points;
}

test('size chart covers S through XL', () => {
  assert.deepEqual(Object.keys(SIZE_CHART), ['S', 'M', 'L', 'XL']);
  for (const chart of Object.values(SIZE_CHART)) {
    assert.ok(chart.chestMax > chart.chestMin);
    assert.ok(chart.heightMax > chart.heightMin);
    assert.ok(chart.weightMax > chart.weightMin);
  }
});

test('recommendSize maps body measurements to a size', () => {
  assert.equal(recommendSize({ height: 158, weight: 50, chest: 88 }), 'S');
  assert.equal(recommendSize({ height: 168, weight: 62, chest: 96 }), 'M');
  assert.equal(recommendSize({ height: 175, weight: 72, chest: 104 }), 'L');
  assert.equal(recommendSize({ height: 185, weight: 88, chest: 112 }), 'XL');
});

test('recommendSize applies fit preference', () => {
  const base = { height: 168, weight: 62, chest: 96 };
  assert.equal(recommendSize({ ...base, fit: 'regular' }), 'M');
  assert.equal(recommendSize({ ...base, fit: 'oversize' }), 'L');
  assert.equal(recommendSize({ ...base, fit: 'slim' }), 'S');
});

test('recommendSize handles partial data', () => {
  assert.ok(['S', 'M', 'L', 'XL'].includes(recommendSize({})));
  assert.ok(['S', 'M', 'L', 'XL'].includes(recommendSize({ height: 170 })));
});

test('sizeConfidence reports completeness', () => {
  assert.equal(sizeConfidence({}), 0);
  assert.equal(sizeConfidence({ height: 170 }), 33);
  assert.equal(sizeConfidence({ height: 170, weight: 65, chest: 96 }), 100);
});

test('computeGarmentTransform returns visible transform for a full pose', () => {
  const t = computeGarmentTransform(landmarks(), { width: 720, height: 1280, type: 'tshirt' });
  assert.equal(t.visible, true);
  assert.ok(t.width > 0);
  assert.ok(t.height > 0);
  assert.ok(Math.abs(t.angle) < 0.01);
  // Shoulder midpoint y=0.3; torso anchored lower.
  assert.ok(t.y > 0.3 * 1280 && t.y < 0.58 * 1280);
  // Garment should be at least as wide as the shoulders.
  assert.ok(t.width > t.shoulderWidth);
});

test('computeGarmentTransform rotates with tilted shoulders', () => {
  const points = landmarks();
  points[11] = { x: 0.36, y: 0.28, visibility: 0.95 };
  points[12] = { x: 0.64, y: 0.33, visibility: 0.95 };
  const t = computeGarmentTransform(points, { width: 720, height: 1280, type: 'kemeja' });
  assert.equal(t.visible, true);
  assert.ok(Math.abs(t.angle) > 0.05);
});

test('computeGarmentTransform hides when landmarks are missing or invisible', () => {
  assert.equal(computeGarmentTransform(null).visible, false);
  assert.equal(computeGarmentTransform([], {}).visible, false);

  const points = landmarks();
  points[11].visibility = 0.05;
  points[12].visibility = 0.05;
  assert.equal(computeGarmentTransform(points, { width: 720, height: 1280 }).visible, false);
});

test('dress renders longer than a t-shirt on the same pose', () => {
  const tee = computeGarmentTransform(landmarks(), { width: 720, height: 1280, type: 'tshirt' });
  const dress = computeGarmentTransform(landmarks(), { width: 720, height: 1280, type: 'dress' });
  assert.ok(dress.height > tee.height);
});

test('mannequinTransform centers the garment', () => {
  const t = mannequinTransform({ width: 720, height: 1280, type: 'hoodie' });
  assert.equal(t.visible, true);
  assert.equal(t.x, 360);
  assert.ok(t.y > 300 && t.y < 900);
  assert.ok(t.width > 0 && t.height > 0);
});

test('scale option changes garment size', () => {
  const normal = mannequinTransform({ width: 720, height: 1280 });
  const large = mannequinTransform({ width: 720, height: 1280, scale: 1.4 });
  assert.ok(large.width > normal.width);
});
