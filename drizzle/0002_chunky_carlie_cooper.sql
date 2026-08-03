CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`educator_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`educator_id`) REFERENCES `educators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_sessions_educator` ON `sessions` (`educator_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_expiry` ON `sessions` (`expires_at`);--> statement-breakpoint
ALTER TABLE `educators` ADD `password_hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_educators_email` ON `educators` (`email`);