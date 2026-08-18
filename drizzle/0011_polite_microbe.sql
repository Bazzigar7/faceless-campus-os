CREATE TABLE `rwa_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`creator_user_id` text,
	`name` text NOT NULL,
	`symbol` text NOT NULL,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`rights` text NOT NULL,
	`income_model` text NOT NULL,
	`risk` text NOT NULL,
	`total_units` integer NOT NULL,
	`price_credits` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`creator_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_rwa_assets_symbol` ON `rwa_assets` (`symbol`);--> statement-breakpoint
CREATE INDEX `idx_rwa_assets_status_time` ON `rwa_assets` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_rwa_assets_creator_time` ON `rwa_assets` (`creator_user_id`,`created_at`);