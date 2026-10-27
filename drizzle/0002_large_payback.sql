DROP INDEX `crawl_users_last_crawled_idx`;--> statement-breakpoint
ALTER TABLE `crawl_users` ADD `last_mmr` integer;--> statement-breakpoint
CREATE INDEX `crawl_users_queue_idx` ON `crawl_users` (`last_crawled_at`,`last_mmr`);