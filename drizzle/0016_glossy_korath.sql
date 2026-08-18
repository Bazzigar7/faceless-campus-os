CREATE TABLE `campaign_enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`user_id` text NOT NULL,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_campaign_enrollments_campaign_user` ON `campaign_enrollments` (`campaign_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_campaign_enrollments_user_time` ON `campaign_enrollments` (`user_id`,`joined_at`);--> statement-breakpoint
ALTER TABLE `campaigns` ADD `brand` text DEFAULT 'Faceless Partner' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `platform` text DEFAULT 'Instagram' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `spots` integer DEFAULT 50 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_submissions_campaign_user` ON `campaign_submissions` (`campaign_id`,`user_id`);