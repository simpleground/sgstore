CREATE TABLE `cart_items` (`user_id` text NOT NULL, `product_id` text NOT NULL, `variant_index` integer NOT NULL, `quantity` integer NOT NULL, `updated_at` text NOT NULL, PRIMARY KEY (`user_id`,`product_id`,`variant_index`));
--> statement-breakpoint
CREATE INDEX `idx_cart_items_user` ON `cart_items` (`user_id`);
--> statement-breakpoint
PRAGMA optimize;
