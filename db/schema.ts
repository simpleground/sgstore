/**
 * Row types for the PostgreSQL tables (the SQL source of truth lives in
 * db/migrations/*.sql). Boolean-like columns are INTEGER 0/1.
 */
export type OrderRow = {
  id: number;
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
  created_at: string;
  updated_at: string;
};
