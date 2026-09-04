ALTER TABLE `products` ADD `weight_grams` integer DEFAULT 500 NOT NULL;
--> statement-breakpoint
CREATE TABLE `shipping_settings` (
	`courier_code` text PRIMARY KEY NOT NULL,
	`courier_name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`updated_at` text NOT NULL
);
