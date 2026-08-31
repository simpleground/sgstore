ALTER TABLE `products` ADD `subcategory` text DEFAULT 'Lainnya' NOT NULL;
--> statement-breakpoint
UPDATE `products` SET
  `category` = CASE WHEN `category` = 'Chef' THEN 'Chef & Kitchen Wear' WHEN `category` = 'Daily' THEN 'Daily Basic' ELSE `category` END,
  `subcategory` = CASE
    WHEN lower(`name`) LIKE '%topi%' THEN 'Topi Chef'
    WHEN lower(`name`) LIKE '%apron%' THEN 'Apron'
    WHEN lower(`name`) LIKE '%chef%' THEN 'Baju Chef'
    WHEN lower(`name`) LIKE '%pdl%' THEN 'Kemeja PDL'
    WHEN lower(`name`) LIKE '%seragam%' THEN 'Seragam Kerja'
    WHEN lower(`name`) LIKE '%kaos%' THEN 'Kaos'
    WHEN lower(`name`) LIKE '%kemeja%' THEN 'Kemeja'
    WHEN lower(`name`) LIKE '%celana%' THEN 'Celana'
    ELSE 'Lainnya'
  END;
--> statement-breakpoint
PRAGMA optimize;
