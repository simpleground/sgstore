import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  orderNumber: text('order_number').notNull().unique(),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  shippingAddress: text('shipping_address').notNull(),
  itemsJson: text('items_json').notNull(),
  subtotal: integer('subtotal').notNull(),
  shipping: integer('shipping').notNull(),
  total: integer('total').notNull(),
  paymentMethod: text('payment_method').notNull().default('Bank Mandiri'),
  status: text('status').notNull().default('menunggu_pembayaran'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [index('idx_orders_status_created').on(table.status, table.createdAt)]);

export const adminUsers = sqliteTable('admin_users', {
  userId: text('user_id').primaryKey(),
  email: text('email').notNull(),
  createdAt: text('created_at').notNull(),
});
