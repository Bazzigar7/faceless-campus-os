CREATE TABLE `testnet_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`chain` text NOT NULL,
	`network` text NOT NULL,
	`standard` text NOT NULL,
	`name` text NOT NULL,
	`symbol` text NOT NULL,
	`description` text NOT NULL,
	`purpose` text NOT NULL,
	`total_supply` text NOT NULL,
	`decimals` integer NOT NULL,
	`authority_mode` text NOT NULL,
	`creator_address` text NOT NULL,
	`token_address` text,
	`creator_token_account` text,
	`status` text DEFAULT 'prepared' NOT NULL,
	`deploy_tx_hash` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_testnet_tokens_user_time` ON `testnet_tokens` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_testnet_tokens_status_time` ON `testnet_tokens` (`status`,`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_testnet_tokens_deploy_tx` ON `testnet_tokens` (`deploy_tx_hash`);--> statement-breakpoint
CREATE TABLE `token_transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`token_id` text NOT NULL,
	`from_user_id` text NOT NULL,
	`to_user_id` text NOT NULL,
	`from_address` text NOT NULL,
	`to_address` text NOT NULL,
	`amount` text NOT NULL,
	`transaction_hash` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`token_id`) REFERENCES `testnet_tokens`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_token_transfers_tx` ON `token_transfers` (`transaction_hash`);--> statement-breakpoint
CREATE INDEX `idx_token_transfers_token_time` ON `token_transfers` (`token_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_token_transfers_from_time` ON `token_transfers` (`from_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_token_transfers_to_time` ON `token_transfers` (`to_user_id`,`created_at`);