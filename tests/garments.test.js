import test from 'node:test';
import assert from 'node:assert/strict';
import { GARMENT_TYPES, garmentAspect, garmentDataUrl, garmentSVG, shade } from '../src/garments.js';

test('all garment types render valid svg strings', () => {
  for (const type of GARMENT_TYPES) {
    const svg = garmentSVG(type, '#334455');
    assert.ok(svg.startsWith('<svg'));
    assert.ok(svg.endsWith('</svg>'));
    assert.ok(svg.includes('viewBox="0 0 320 360"'));
    assert.ok(svg.includes('fill="#334455"') || svg.includes('fill="#334455"'.toUpperCase()));
  }
});

test('unknown type falls back to t-shirt', () => {
  const fallback = garmentSVG('does-not-exist', '#ff0000');
  assert.equal(fallback, garmentSVG('tshirt', '#ff0000'));
});

test('garmentDataUrl encodes the svg', () => {
  const url = garmentDataUrl('hoodie', '#000000');
  assert.ok(url.startsWith('data:image/svg+xml'));
  assert.ok(url.includes('%3Csvg'));
  assert.equal(decodeURIComponent(url.split(',')[1]).startsWith('<svg'), true);
});

test('shade lightens and darkens colors', () => {
  const darker = shade('#808080', -0.5);
  const lighter = shade('#808080', 0.5);
  assert.ok(parseInt(darker.slice(1, 3), 16) < 0x80);
  assert.ok(parseInt(lighter.slice(1, 3), 16) > 0x80);
  assert.equal(shade('#000000', -1), '#000000');
  assert.equal(shade('#ffffff', 1), '#ffffff');
});

test('garmentAspect is stable', () => {
  assert.equal(garmentAspect('tshirt'), 360 / 320);
});

test('GARMENT_TYPES covers all catalog types', () => {
  for (const type of ['tshirt', 'polo', 'kemeja', 'flannel', 'hoodie', 'sweater', 'dress', 'jacket']) {
    assert.ok(GARMENT_TYPES.includes(type), `missing ${type}`);
  }
});
