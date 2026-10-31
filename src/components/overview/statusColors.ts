// Order status colours — mirror the badges on /creator/orders so the overview
// reads the same as the orders list.
export const ORDER_STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-200',
  PROCESSING: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  MANUFACTURING: 'bg-purple-50 text-purple-700 border-purple-200',
  QUALITY_CHECK: 'bg-orange-50 text-orange-700 border-orange-200',
  SHIPPED: 'bg-sky-50 text-sky-700 border-sky-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  RETURNED: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  CANCELLED: 'bg-red-50 text-red-700 border-red-200',
  REFUNDED: 'bg-zinc-100 text-zinc-700 border-zinc-200',
};

export const DEFAULT_STATUS_BADGE = 'bg-zinc-100 text-zinc-700 border-zinc-200';

// Order of statuses in the breakdown (lifecycle order, not by count).
export const STATUS_ORDER = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'MANUFACTURING',
  'QUALITY_CHECK',
  'SHIPPED',
  'DELIVERED',
  'RETURNED',
  'CANCELLED',
  'REFUNDED',
];
