ALTER TABLE `products` ADD `description` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `products` ADD `variants_json` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
PRAGMA optimize;
