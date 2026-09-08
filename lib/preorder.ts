export type PreorderProduct = { preorder_enabled?: number | boolean; preorder_days?: number };
export function isPreorder(product: PreorderProduct, variant: {stock?: number}) {
  return Boolean(product.preorder_enabled) || variant.stock === 0;
}
export function quantityLimit(product: PreorderProduct, variant: {stock?: number}) {
  if (!Number.isInteger(variant.stock) || variant.stock! < 0) return 0;
  return isPreorder(product, variant) ? 99 : Math.min(99, variant.stock!);
}
export function preorderLabel(product: PreorderProduct, variant: {stock?: number}) {
  return isPreorder(product, variant) ? `Pre-order · siap kirim dalam ${product.preorder_days || 2} hari setelah pembayaran` : `Stok: ${variant.stock}`;
}
