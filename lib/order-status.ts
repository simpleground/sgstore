/** Order statuses an admin can set, in processing order. */
export const ORDER_STATUSES = [
  'menunggu_pembayaran',
  'dibayar',
  'diproses',
  'dikirim',
  'selesai',
  'dibatalkan',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const isOrderStatus = (value: unknown): value is OrderStatus =>
  typeof value === 'string' &&
  (ORDER_STATUSES as readonly string[]).includes(value);
