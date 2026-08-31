import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const orders = sqliteTable(
  'orders',
  {
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
  },
  (table) => [
    index('idx_orders_status_created').on(table.status, table.createdAt),
  ],
);

export const adminUsers = sqliteTable('admin_users', {
  userId: text('user_id').primaryKey(),
  email: text('email').notNull(),
  createdAt: text('created_at').notNull(),
});

export const products = sqliteTable(
  'products',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    category: text('category').notNull(),
    tone: text('tone').notNull(),
    description: text('description').notNull().default(''),
    variantsJson: text('variants_json').notNull().default('[]'),
    price: integer('price').notNull(),
    stock: integer('stock').notNull().default(0),
    imageUrl: text('image_url'),
    imageKey: text('image_key'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_products_active_category').on(table.active, table.category),
  ],
);
