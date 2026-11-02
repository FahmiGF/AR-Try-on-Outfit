/**
 * Metadata & helper pesanan yang dipakai storefront maupun admin.
 * Murni (tanpa DOM) agar mudah diuji.
 */

export const ORDER_FLOW = ['pending', 'paid', 'shipped', 'completed'];

export const ORDER_STATUS = {
  pending: { label: 'Menunggu', short: 'Menunggu', color: '#a2720f', bg: 'rgba(232, 176, 75, 0.16)' },
  paid: { label: 'Dibayar', short: 'Dibayar', color: '#3b6fd4', bg: 'rgba(59, 111, 212, 0.12)' },
  shipped: { label: 'Dikirim', short: 'Dikirim', color: '#6e3fae', bg: 'rgba(130, 74, 190, 0.12)' },
  completed: { label: 'Selesai', short: 'Selesai', color: '#1f8a5b', bg: 'rgba(31, 138, 91, 0.12)' },
  cancelled: { label: 'Dibatalkan', short: 'Batal', color: '#c0392b', bg: 'rgba(192, 57, 43, 0.1)' },
  refunded: { label: 'Dikembalikan', short: 'Refund', color: '#c0392b', bg: 'rgba(192, 57, 43, 0.1)' },
};

export function orderStatusLabel(status) {
  return ORDER_STATUS[status]?.label || status;
}

export function orderStatusStyle(status) {
  return ORDER_STATUS[status] || { label: status, color: '#4c3d43', bg: 'rgba(27, 17, 21, 0.06)' };
}

/**
 * Langkah progres pesanan untuk timeline pelanggan.
 * Status batal/refund tidak mengikuti alur normal.
 */
export function orderProgress(status) {
  const cancelled = status === 'cancelled' || status === 'refunded';
  const currentIndex = ORDER_FLOW.indexOf(status);
  return ORDER_FLOW.map((key, index) => ({
    key,
    label: ORDER_STATUS[key].label,
    done: !cancelled && currentIndex >= index,
    current: !cancelled && currentIndex === index,
    cancelled,
  }));
}

export function orderItemCount(order) {
  return (order?.items || []).reduce((sum, item) => sum + Number(item.qty || 0), 0);
}

export function orderItemSummary(order, max = 2) {
  const items = order?.items || [];
  if (!items.length) return '-';
  const shown = items
    .slice(0, max)
    .map((item) => `${item.name} (${item.size}) ×${item.qty}`)
    .join(', ');
  return items.length > max ? `${shown} +${items.length - max} lainnya` : shown;
}

export function formatOrderDate(value, withTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}
