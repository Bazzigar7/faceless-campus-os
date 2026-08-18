CREATE TABLE `token_airdrop_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`airdrop_id` text NOT NULL,
	`user_id` text NOT NULL,
	`wallet_address` text NOT NULL,
	`amount` text NOT NULL,
	`transaction_hash` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`error_message` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`airdrop_id`) REFERENCES `token_airdrops`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_token_airdrop_claims_airdrop_user` ON `token_airdrop_claims` (`airdrop_id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_token_airdrop_claims_tx` ON `token_airdrop_claims` (`transaction_hash`);--> statement-breakpoint
CREATE INDEX `idx_token_airdrop_claims_status_time` ON `token_airdrop_claims` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `token_airdrops` (
	`id` text PRIMARY KEY NOT NULL,
	`token_id` text NOT NULL,
	`creator_user_id` text NOT NULL,
	`amount_per_claim` text NOT NULL,
	`max_claims` integer NOT NULL,
	`total_allocation` text NOT NULL,
	`distributor_address` text NOT NULL,
	`funding_transaction_hash` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`token_id`) REFERENCES `testnet_tokens`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`creator_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_token_airdrops_token_status` ON `token_airdrops` (`token_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_token_airdrops_creator_time` ON `token_airdrops` (`creator_user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_token_airdrops_funding_tx` ON `token_airdrops` (`funding_transaction_hash`);