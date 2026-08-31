ALTER TABLE `products` ADD `images_json` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
PRAGMA optimize;
