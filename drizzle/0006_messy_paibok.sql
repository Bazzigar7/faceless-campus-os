CREATE TABLE `rwa_holdings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`units` integer DEFAULT 0 NOT NULL,
	`total_cost_credits` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_rwa_holdings_user_asset` ON `rwa_holdings` (`user_id`,`asset_id`);--> statement-breakpoint
CREATE INDEX `idx_rwa_holdings_user` ON `rwa_holdings` (`user_id`);--> statement-breakpoint
CREATE TABLE `rwa_trades` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`side` text NOT NULL,
	`units` integer NOT NULL,
	`price_credits` integer NOT NULL,
	`total_credits` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_rwa_trades_user_time` ON `rwa_trades` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_rwa_trades_asset_time` ON `rwa_trades` (`asset_id`,`created_at`);