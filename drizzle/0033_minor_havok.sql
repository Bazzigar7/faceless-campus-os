CREATE TABLE `partner_daily_missions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`day_key` text NOT NULL,
	`trading_wallet` text NOT NULL,
	`xp_amount` integer DEFAULT 50 NOT NULL,
	`status` text DEFAULT 'verified' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_partner_daily_user_day` ON `partner_daily_missions` (`user_id`,`day_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_partner_daily_wallet_day` ON `partner_daily_missions` (`trading_wallet`,`day_key`);--> statement-breakpoint
CREATE INDEX `idx_partner_daily_user_time` ON `partner_daily_missions` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `partner_daily_trades` (
	`id` text PRIMARY KEY NOT NULL,
	`mission_id` text NOT NULL,
	`user_id` text NOT NULL,
	`transaction_hash` text NOT NULL,
	`token_address` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`mission_id`) REFERENCES `partner_daily_missions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_partner_daily_trade_hash` ON `partner_daily_trades` (`transaction_hash`);--> statement-breakpoint
CREATE INDEX `idx_partner_daily_trades_mission` ON `partner_daily_trades` (`mission_id`);--> statement-breakpoint
CREATE INDEX `idx_partner_daily_trades_user_time` ON `partner_daily_trades` (`user_id`,`created_at`);