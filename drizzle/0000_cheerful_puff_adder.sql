CREATE TABLE `campaign_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`user_id` text NOT NULL,
	`content_url` text NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`review_notes` text,
	`reviewed_by` text,
	`submitted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`reviewed_at` text,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_submissions_campaign_status` ON `campaign_submissions` (`campaign_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_submissions_user_time` ON `campaign_submissions` (`user_id`,`submitted_at`);--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`brief` text NOT NULL,
	`campaign_type` text NOT NULL,
	`reward_amount` text NOT NULL,
	`reward_currency` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_campaigns_status_created` ON `campaigns` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `cohort_members` (
	`id` text PRIMARY KEY NOT NULL,
	`cohort_id` text NOT NULL,
	`user_id` text NOT NULL,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cohort_id`) REFERENCES `cohorts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_cohort_members_cohort_user` ON `cohort_members` (`cohort_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_cohort_members_user` ON `cohort_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `cohorts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`college` text NOT NULL,
	`expected_students` integer DEFAULT 200 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `educator_permissions` (
	`user_id` text PRIMARY KEY NOT NULL,
	`can_approve_mainnet` integer DEFAULT false NOT NULL,
	`can_manage_educators` integer DEFAULT false NOT NULL,
	`granted_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`granted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `faucet_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`chain` text NOT NULL,
	`amount` text NOT NULL,
	`transaction_hash` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`claimed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_faucet_claims_user_chain_time` ON `faucet_claims` (`user_id`,`chain`,`claimed_at`);--> statement-breakpoint
CREATE INDEX `idx_faucet_claims_status` ON `faucet_claims` (`status`);--> statement-breakpoint
CREATE TABLE `mainnet_launch_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`chain` text NOT NULL,
	`asset_type` text NOT NULL,
	`testnet_reference` text NOT NULL,
	`metadata_url` text,
	`status` text DEFAULT 'requested' NOT NULL,
	`reviewed_by` text,
	`review_notes` text,
	`requested_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`reviewed_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_mainnet_requests_status_time` ON `mainnet_launch_requests` (`status`,`requested_at`);--> statement-breakpoint
CREATE INDEX `idx_mainnet_requests_user` ON `mainnet_launch_requests` (`user_id`);--> statement-breakpoint
CREATE TABLE `payouts` (
	`id` text PRIMARY KEY NOT NULL,
	`submission_id` text NOT NULL,
	`user_id` text NOT NULL,
	`method` text NOT NULL,
	`destination_reference` text NOT NULL,
	`amount` text NOT NULL,
	`currency` text NOT NULL,
	`status` text DEFAULT 'approved' NOT NULL,
	`approved_by` text NOT NULL,
	`transaction_reference` text,
	`approved_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`paid_at` text,
	FOREIGN KEY (`submission_id`) REFERENCES `campaign_submissions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_payouts_submission` ON `payouts` (`submission_id`);--> statement-breakpoint
CREATE INDEX `idx_payouts_status_time` ON `payouts` (`status`,`approved_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_provider` text DEFAULT 'privy' NOT NULL,
	`provider_user_id` text NOT NULL,
	`email` text NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'student' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_provider_identity` ON `users` (`auth_provider`,`provider_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_username` ON `users` (`username`);--> statement-breakpoint
CREATE INDEX `idx_users_role_status` ON `users` (`role`,`status`);--> statement-breakpoint
CREATE TABLE `wallets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`chain` text NOT NULL,
	`wallet_type` text NOT NULL,
	`address` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_wallets_chain_address` ON `wallets` (`chain`,`address`);--> statement-breakpoint
CREATE INDEX `idx_wallets_user_chain` ON `wallets` (`user_id`,`chain`);--> statement-breakpoint
CREATE INDEX `idx_wallets_user_primary` ON `wallets` (`user_id`,`is_primary`);