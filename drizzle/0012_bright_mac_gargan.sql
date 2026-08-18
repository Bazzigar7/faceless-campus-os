CREATE TABLE `rwa_distributions` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`user_id` text NOT NULL,
	`period` text NOT NULL,
	`units_snapshot` integer NOT NULL,
	`amount_credits` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `rwa_assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_rwa_distributions_asset_user_period` ON `rwa_distributions` (`asset_id`,`user_id`,`period`);--> statement-breakpoint
CREATE INDEX `idx_rwa_distributions_user_time` ON `rwa_distributions` (`user_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `rwa_assets` ADD `annual_yield_bps` integer DEFAULT 0 NOT NULL;