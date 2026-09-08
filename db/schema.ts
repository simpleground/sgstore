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
    paymentTokenHash: text('payment_token_hash'),
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
    subcategory: text('subcategory').notNull().default('Lainnya'),
    tone: text('tone').notNull(),
    description: text('description').notNull().default(''),
    material: text('material').notNull().default(''),
    careInstructions: text('care_instructions').notNull().default(''),
    productionEstimate: text('production_estimate').notNull().default(''),
    sizeGuide: text('size_guide').notNull().default(''),
    variantsJson: text('variants_json').notNull().default('[]'),
    price: integer('price').notNull(),
    stock: integer('stock').notNull().default(0),
    soldCount: integer('sold_count').notNull().default(0),
    preorderEnabled: integer('preorder_enabled').notNull().default(0),
    preorderDays: integer('preorder_days').notNull().default(2),
    weightGrams: integer('weight_grams').notNull().default(500),
    imageUrl: text('image_url'),
    imageKey: text('image_key'),
    imagesJson: text('images_json').notNull().default('[]'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    deletedAt: text('deleted_at'),
  },
  (table) => [
    index('idx_products_active_category').on(table.active, table.category),
    index('idx_products_deleted_at').on(table.deletedAt),
  ],
);

export const shippingSettings = sqliteTable('shipping_settings', {
  courierCode: text('courier_code').primaryKey(),
  courierName: text('courier_name').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  updatedAt: text('updated_at').notNull(),
});

export const customers = sqliteTable('customers', {
  userId: text('user_id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: text('created_at').notNull(),
});
export const newsletterSubscribers = sqliteTable('newsletter_subscribers', {
  email: text('email').primaryKey(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
export const customerSessions = sqliteTable(
  'customer_sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: text('user_id').notNull(),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_customer_sessions_user').on(table.userId)],
);

export const reviews = sqliteTable(
  'reviews',
  {
    id: text('id').primaryKey(),
    productId: text('product_id').notNull(),
    userId: text('user_id'),
    orderNumber: text('order_number'),
    displayName: text('display_name').notNull(),
    city: text('city').notNull().default(''),
    rating: integer('rating').notNull(),
    body: text('body').notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    adminCreated: integer('admin_created', { mode: 'boolean' })
      .notNull()
      .default(false),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_reviews_product_active').on(table.productId, table.active),
  ],
);
export const cartItems = sqliteTable(
  'cart_items',
  {
    userId: text('user_id').notNull(),
    productId: text('product_id').notNull(),
    variantIndex: integer('variant_index').notNull(),
    quantity: integer('quantity').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('idx_cart_items_user').on(table.userId)],
);
