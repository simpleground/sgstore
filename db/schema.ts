/**
 * Row types for the PostgreSQL tables (the SQL source of truth lives in
 * db/migrations/*.sql). Boolean-like columns are INTEGER 0/1.
 */
export type OrderRow = {
  id: number;
  store_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  shipping_address: string;
  items_json: string;
  subtotal: number;
  shipping: number;
  total: number;
  payment_token_hash: string | null;
  payment_method: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ProductRow = {
  id: string;
  store_id: string;
  name: string;
  category: string;
  subcategory: string;
  tone: string;
  description: string;
  material: string;
  care_instructions: string;
  production_estimate: string;
  size_guide: string;
  variants_json: string;
  price: number;
  stock: number;
  sold_count: number;
  preorder_enabled: number;
  preorder_days: number;
  weight_grams: number;
  image_url: string | null;
  image_key: string | null;
  images_json: string;
  active: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type AdminUserRow = {
  user_id: string;
  email: string;
  name: string;
  password_hash: string | null;
  platform_role: 'super_admin' | null;
  created_at: string;
  updated_at: string;
};

export type StoreRow = {
  id: string;
  slug: string;
  name: string;
  status: 'active' | 'suspended' | 'closed';
  email: string;
  phone: string;
  address: string;
  timezone: string;
  currency: string;
  created_at: string;
  updated_at: string;
};

export type StoreDomainRow = {
  host: string;
  store_id: string;
  is_primary: number;
  created_at: string;
};

export type StoreMembershipRow = {
  store_id: string;
  user_id: string;
  role: 'store_owner' | 'store_admin' | 'store_staff';
  created_at: string;
  updated_at: string;
};
