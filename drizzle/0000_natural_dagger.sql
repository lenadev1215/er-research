CREATE TABLE `characters` (
	`code` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `crawl_users` (
	`nickname` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`last_crawled_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `crawl_users_last_crawled_idx` ON `crawl_users` (`last_crawled_at`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` integer PRIMARY KEY NOT NULL,
	`season_id` integer NOT NULL,
	`version_major` integer NOT NULL,
	`version_minor` integer NOT NULL,
	`started_at` text NOT NULL,
	`team_count` integer NOT NULL,
	`avg_mmr` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `games_season_idx` ON `games` (`season_id`,`version_major`,`version_minor`);--> statement-breakpoint
CREATE TABLE `participants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer NOT NULL,
	`team_number` integer NOT NULL,
	`game_rank` integer NOT NULL,
	`character_code` integer NOT NULL,
	`weapon_code` integer NOT NULL,
	`core_trait_code` integer NOT NULL,
	`mmr_before` integer NOT NULL,
	`mmr_gain` integer NOT NULL,
	`pre_made` integer NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `participants_game_team_idx` ON `participants` (`game_id`,`team_number`);--> statement-breakpoint
CREATE INDEX `participants_pick_idx` ON `participants` (`character_code`,`weapon_code`,`core_trait_code`);--> statement-breakpoint
CREATE TABLE `traits` (
	`code` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`group` text NOT NULL,
	`type` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weapons` (
	`code` integer PRIMARY KEY NOT NULL,
	`mastery_type` text NOT NULL,
	`name` text NOT NULL
);
