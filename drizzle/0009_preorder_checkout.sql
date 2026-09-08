ALTER TABLE `products` ADD `preorder_enabled` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `products` ADD `preorder_days` integer DEFAULT 2 NOT NULL;
--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_token_hash` text;
