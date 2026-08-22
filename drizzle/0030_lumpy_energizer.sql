CREATE TABLE `partner_lab_members` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'invited' NOT NULL,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `partner_lab_teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_partner_lab_members_team_user` ON `partner_lab_members` (`team_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_partner_lab_members_user` ON `partner_lab_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `partner_lab_proofs` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`proof_type` text NOT NULL,
	`transaction_hash` text,
	`feedback` text,
	`status` text DEFAULT 'submitted' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `partner_lab_teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_partner_lab_proofs_team_user_type` ON `partner_lab_proofs` (`team_id`,`user_id`,`proof_type`);--> statement-breakpoint
CREATE INDEX `idx_partner_lab_proofs_team_status` ON `partner_lab_proofs` (`team_id`,`status`);--> statement-breakpoint
CREATE TABLE `partner_lab_teams` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_key` text NOT NULL,
	`name` text NOT NULL,
	`character_name` text DEFAULT 'Character pending' NOT NULL,
	`token_name` text DEFAULT '' NOT NULL,
	`token_symbol` text DEFAULT '' NOT NULL,
	`launcher_user_id` text NOT NULL,
	`token_address` text,
	`launch_tx_hash` text,
	`status` text DEFAULT 'forming' NOT NULL,
	`review_notes` text,
	`verified_by` text,
	`verified_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`launcher_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_partner_lab_teams_campaign_status` ON `partner_lab_teams` (`campaign_key`,`status`);--> statement-breakpoint
CREATE INDEX `idx_partner_lab_teams_launcher` ON `partner_lab_teams` (`launcher_user_id`);