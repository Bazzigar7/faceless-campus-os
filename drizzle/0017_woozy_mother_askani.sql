CREATE TABLE `partner_drop_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`drop_id` text NOT NULL,
	`user_id` text NOT NULL,
	`evidence` text NOT NULL,
	`claimed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`drop_id`) REFERENCES `partner_drops`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_partner_drop_claims_drop_user` ON `partner_drop_claims` (`drop_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_partner_drop_claims_user_time` ON `partner_drop_claims` (`user_id`,`claimed_at`);--> statement-breakpoint
CREATE TABLE `partner_drops` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`host` text NOT NULL,
	`description` text NOT NULL,
	`reward_label` text DEFAULT 'Campus credential' NOT NULL,
	`eligibility` text DEFAULT 'open' NOT NULL,
	`max_claims` integer DEFAULT 200 NOT NULL,
	`status` text DEFAULT 'live' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_partner_drops_status_time` ON `partner_drops` (`status`,`created_at`);