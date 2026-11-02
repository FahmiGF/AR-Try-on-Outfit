/**
 * Keranjang belanja murni (tanpa DOM / localStorage).
 */

export const PROMOS = {
  MATAHARI10: { type: 'percent', value: 10, label: 'Diskon 10%' },
  GRATISONGKIR: { type: 'shipping', value: 1, label: 'Gratis ongkir' },
  HEMAT50: { type: 'fixed', value: 50000, label: 'Potongan Rp50.000' },
};

export const SHIPPING_FLAT = 20000;
export const FREE_SHIPPING_MIN = 300000;

export function cartKey(productId, size, color) {
  return `${productId}::${size}::${color}`;
}

export function addToCart(cart, product, { size, color, qty = 1 } = {}) {
  const chosenSize = size || Object.keys(product.stock || {})[0] || 'M';
  const chosenColor = color || product.colors?.[0]?.name || 'Default';
  const key = cartKey(product.id, chosenSize, chosenColor);
  const items = Array.isArray(cart.items) ? [...cart.items] : [];
  const existing = items.find((item) => item.key === key);
  const available = Number(product.stock?.[chosenSize] ?? 0);
  const nextQty = Math.min(available || 99, (existing?.qty || 0) + Math.max(1, qty));

  if (existing) {
    existing.qty = nextQty;
    existing.price = product.price;
  } else {
    items.push({
      key,
      productId: product.id,
      name: product.name,
      type: product.type,
      price: product.price,
      size: chosenSize,
      color: chosenColor,
      colorHex: product.colors?.find((c) => c.name === chosenColor)?.hex || '#24252a',
      qty: nextQty,
    });
  }

  return { ...cart, items };
}

export function removeFromCart(cart, key) {
  return { ...cart, items: (cart.items || []).filter((item) => item.key !== key) };
}

export function setQty(cart, key, qty) {
  if (qty <= 0) return removeFromCart(cart, key);
  return {
    ...cart,
    items: (cart.items || []).map((item) => (item.key === key ? { ...item, qty } : item)),
  };
}

export function cartSubtotal(cart) {
  return (cart.items || []).reduce((sum, item) => sum + Number(item.price || 0) * Number(item.qty || 0), 0);
}

export function cartCount(cart) {
  return (cart.items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
}

/**
 * Hitung ringkasan belanja: subtotal, diskon, ongkir, total.
 */
export function summarizeCart(cart, promoCode = '') {
  const subtotal = cartSubtotal(cart);
  const promo = PROMOS[String(promoCode || '').toUpperCase().trim()] || null;
  let discount = 0;
  let shipping = subtotal >= FREE_SHIPPING_MIN || subtotal === 0 ? 0 : SHIPPING_FLAT;

  if (promo?.type === 'percent') discount = Math.round(subtotal * (promo.value / 100));
  if (promo?.type === 'fixed') discount = Math.min(subtotal, promo.value);
  if (promo?.type === 'shipping') shipping = 0;

  const total = Math.max(0, subtotal - discount) + shipping;
  return { subtotal, discount, shipping, total, promo, itemCount: cartCount(cart) };
}

export function emptyCart() {
  return { items: [] };
}
