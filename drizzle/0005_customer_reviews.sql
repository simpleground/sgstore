CREATE TABLE `customers` (`user_id` text PRIMARY KEY NOT NULL, `name` text NOT NULL, `email` text NOT NULL UNIQUE, `created_at` text NOT NULL);
--> statement-breakpoint
CREATE TABLE `customer_sessions` (`token_hash` text PRIMARY KEY NOT NULL, `user_id` text NOT NULL, `expires_at` text NOT NULL, `created_at` text NOT NULL);
--> statement-breakpoint
CREATE INDEX `idx_customer_sessions_user` ON `customer_sessions` (`user_id`);
--> statement-breakpoint
CREATE TABLE `reviews` (`id` text PRIMARY KEY NOT NULL, `product_id` text NOT NULL, `user_id` text, `order_number` text, `display_name` text NOT NULL, `rating` integer NOT NULL, `body` text NOT NULL, `active` integer DEFAULT true NOT NULL, `admin_created` integer DEFAULT false NOT NULL, `created_at` text NOT NULL, `updated_at` text NOT NULL);
--> statement-breakpoint
CREATE INDEX `idx_reviews_product_active` ON `reviews` (`product_id`,`active`);
--> statement-breakpoint
PRAGMA optimize;
