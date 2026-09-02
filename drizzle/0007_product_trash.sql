ALTER TABLE `products` ADD `deleted_at` text;
CREATE INDEX `idx_products_deleted_at` ON `products` (`deleted_at`);
