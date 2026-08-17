CREATE TABLE `testnet_launches` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`chain` text NOT NULL,
	`network` text NOT NULL,
	`standard` text NOT NULL,
	`name` text NOT NULL,
	`symbol` text NOT NULL,
	`description` text NOT NULL,
	`purpose` text NOT NULL,
	`max_supply` integer NOT NULL,
	`mint_price` text DEFAULT '0' NOT NULL,
	`royalty_bps` integer DEFAULT 0 NOT NULL,
	`creator_address` text NOT NULL,
	`artwork_key` text NOT NULL,
	`artwork_content_type` text NOT NULL,
	`status` text DEFAULT 'prepared' NOT NULL,
	`deploy_tx_hash` text,
	`contract_address` text,
	`mint_tx_hash` text,
	`error_message` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_testnet_launches_user_time` ON `testnet_launches` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_testnet_launches_status` ON `testnet_launches` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_testnet_launches_deploy_tx` ON `testnet_launches` (`deploy_tx_hash`);