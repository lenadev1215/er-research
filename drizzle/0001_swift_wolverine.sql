PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_traits` (
	`code` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`group` text,
	`type` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_traits`("code", "name", "group", "type") SELECT "code", "name", "group", "type" FROM `traits`;--> statement-breakpoint
DROP TABLE `traits`;--> statement-breakpoint
ALTER TABLE `__new_traits` RENAME TO `traits`;--> statement-breakpoint
PRAGMA foreign_keys=ON;