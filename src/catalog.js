/**
 * Katalog produk Matahari.
 * Data murni (tanpa DOM) supaya mudah diuji dan dipakai admin.
 */

export const CATEGORIES = [
  { id: 'all', label: 'Semua' },
  { id: 'kaos', label: 'Kaos & T-Shirt' },
  { id: 'kemeja', label: 'Kemeja' },
  { id: 'polo', label: 'Polo' },
  { id: 'hoodie', label: 'Hoodie & Sweater' },
  { id: 'dress', label: 'Dress' },
  { id: 'outerwear', label: 'Jaket' },
];

export const SIZES = ['S', 'M', 'L', 'XL'];

let seq = 0;
function pid(prefix) {
  seq += 1;
  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

export const SEED_PRODUCTS = [
  {
    id: 'mt-001',
    name: 'Kaos Oversize Cotton Combed 30s',
    category: 'kaos',
    type: 'tshirt',
    price: 79000,
    originalPrice: 129000,
    colors: [
      { name: 'Putih', hex: '#f7f7f2' },
      { name: 'Hitam', hex: '#24252a' },
      { name: 'Sage', hex: '#9caf88' },
    ],
    sizes: ['S', 'M', 'L', 'XL'],
    stock: { S: 24, M: 40, L: 32, XL: 18 },
    rating: 4.8,
    sold: 1240,
    badge: 'Best Seller',
    description: 'Kaos oversize bahan cotton combed 30s, adem dan jatuh sempurna di badan.',
    ar: true,
  },
  {
    id: 'mt-002',
    name: 'Kemeja Linen Relaxed Fit',
    category: 'kemeja',
    type: 'kemeja',
    price: 159000,
    originalPrice: 219000,
    colors: [
      { name: 'Cream', hex: '#efe3cc' },
      { name: 'Navy', hex: '#2c3e67' },
      { name: 'Olive', hex: '#6f7a4f' },
    ],
    sizes: ['M', 'L', 'XL'],
    stock: { M: 15, L: 21, XL: 9 },
    rating: 4.7,
    sold: 860,
    badge: 'New',
    description: 'Kemeja linen premium dengan potongan santai, cocok untuk kerja maupun jalan.',
    ar: true,
  },
  {
    id: 'mt-003',
    name: 'Polo Shirt Pique Premium',
    category: 'polo',
    type: 'polo',
    price: 119000,
    originalPrice: 169000,
    colors: [
      { name: 'Maroon', hex: '#7b2d3b' },
      { name: 'Abu', hex: '#8f949b' },
      { name: 'Biru', hex: '#2f5f9e' },
    ],
    sizes: ['S', 'M', 'L', 'XL'],
    stock: { S: 12, M: 28, L: 25, XL: 14 },
    rating: 4.6,
    sold: 640,
    badge: null,
    description: 'Polo shirt pique dengan kerah rapi dan bahan breathable untuk aktivitas harian.',
    ar: true,
  },
  {
    id: 'mt-004',
    name: 'Hoodie Fleece Heavyweight',
    category: 'hoodie',
    type: 'hoodie',
    price: 189000,
    originalPrice: 259000,
    colors: [
      { name: 'Charcoal', hex: '#3b3d44' },
      { name: 'Cream', hex: '#e8ddc7' },
      { name: 'Forest', hex: '#33513f' },
    ],
    sizes: ['M', 'L', 'XL'],
    stock: { M: 18, L: 22, XL: 11 },
    rating: 4.9,
    sold: 980,
    badge: 'Favorit',
    description: 'Hoodie fleece tebal dengan kangaroo pocket, hangat dan tetap stylish.',
    ar: true,
  },
  {
    id: 'mt-005',
    name: 'Dress Midi A-Line',
    category: 'dress',
    type: 'dress',
    price: 229000,
    originalPrice: 299000,
    colors: [
      { name: 'Dusty Rose', hex: '#c98b8b' },
      { name: 'Hitam', hex: '#26262b' },
      { name: 'Mocca', hex: '#a07a5d' },
    ],
    sizes: ['S', 'M', 'L'],
    stock: { S: 8, M: 14, L: 7 },
    rating: 4.8,
    sold: 420,
    badge: 'Editor Pick',
    description: 'Dress midi A-line dengan bahan flowy, manis untuk acara formal maupun santai.',
    ar: true,
  },
  {
    id: 'mt-006',
    name: 'Jaket Denim Classic Trucker',
    category: 'outerwear',
    type: 'jacket',
    price: 249000,
    originalPrice: 329000,
    colors: [
      { name: 'Light Blue', hex: '#6f96c4' },
      { name: 'Dark Indigo', hex: '#324a6b' },
      { name: 'Hitam', hex: '#2b2c30' },
    ],
    sizes: ['M', 'L', 'XL'],
    stock: { M: 9, L: 13, XL: 6 },
    rating: 4.7,
    sold: 310,
    badge: 'Limited',
    description: 'Jaket denim trucker klasik dengan kancing metal, tahan lama dan mudah dipadukan.',
    ar: true,
  },
  {
    id: 'mt-007',
    name: 'Sweater Rajut Knit Crewneck',
    category: 'hoodie',
    type: 'sweater',
    price: 169000,
    originalPrice: 229000,
    colors: [
      { name: 'Oat', hex: '#d7c7a9' },
      { name: 'Lavender', hex: '#b8a7d1' },
      { name: 'Coklat', hex: '#8a6444' },
    ],
    sizes: ['S', 'M', 'L'],
    stock: { S: 7, M: 16, L: 10 },
    rating: 4.5,
    sold: 260,
    badge: null,
    description: 'Sweater rajut crewneck dengan tekstur lembut, pas untuk cuaca dingin.',
    ar: true,
  },
  {
    id: 'mt-008',
    name: 'Kemeja Flanel Kotak',
    category: 'kemeja',
    type: 'flannel',
    price: 139000,
    originalPrice: 189000,
    colors: [
      { name: 'Merah Hitam', hex: '#8f2f35' },
      { name: 'Biru Hitam', hex: '#2f4d7a' },
    ],
    sizes: ['M', 'L', 'XL'],
    stock: { M: 20, L: 24, XL: 12 },
    rating: 4.4,
    sold: 530,
    badge: null,
    description: 'Kemeja flanel motif kotak dengan bahan tebal, cocok dipakai sebagai outer.',
    ar: true,
  },
];

export function createProductDraft() {
  return {
    id: pid('mt'),
    name: '',
    category: 'kaos',
    type: 'tshirt',
    price: 0,
    originalPrice: 0,
    colors: [{ name: 'Hitam', hex: '#24252a' }],
    sizes: ['S', 'M', 'L', 'XL'],
    stock: { S: 0, M: 0, L: 0, XL: 0 },
    rating: 0,
    sold: 0,
    badge: null,
    description: '',
    ar: true,
  };
}

export function filterProducts(products, { category = 'all', query = '', sort = 'popular' } = {}) {
  const q = String(query).trim().toLowerCase();
  let out = products.filter((product) => {
    const matchCategory = category === 'all' || product.category === category;
    const matchQuery =
      !q ||
      product.name.toLowerCase().includes(q) ||
      product.description.toLowerCase().includes(q) ||
      product.category.toLowerCase().includes(q);
    return matchCategory && matchQuery;
  });

  out = [...out];
  if (sort === 'price-asc') out.sort((a, b) => a.price - b.price);
  else if (sort === 'price-desc') out.sort((a, b) => b.price - a.price);
  else if (sort === 'rating') out.sort((a, b) => b.rating - a.rating);
  else out.sort((a, b) => b.sold - a.sold);

  return out;
}

export function totalStock(product) {
  return Object.values(product.stock || {}).reduce((sum, n) => sum + Number(n || 0), 0);
}

export function isLowStock(product, threshold = 8) {
  return Object.values(product.stock || {}).some((n) => Number(n || 0) <= threshold);
}

export function formatIDR(value) {
  return 'Rp' + Number(value || 0).toLocaleString('id-ID');
}
