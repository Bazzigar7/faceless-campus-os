CREATE TABLE `faucet_configs` (
	`chain` text PRIMARY KEY NOT NULL,
	`amount` text NOT NULL,
	`max_claims` integer DEFAULT 1 NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`distributor_wallet_id` text,
	`distributor_address` text,
	`updated_by` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `faucet_claims` ADD `claim_number` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `faucet_claims` ADD `wallet_address` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `faucet_claims` ADD `error_message` text;--> statement-breakpoint
ALTER TABLE `faucet_claims` ADD `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_faucet_claims_user_chain_number` ON `faucet_claims` (`user_id`,`chain`,`claim_number`);