CREATE TABLE `creator_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`platform` text DEFAULT 'Instagram Reels' NOT NULL,
	`format` text DEFAULT 'faceless' NOT NULL,
	`objective` text NOT NULL,
	`hook` text DEFAULT '' NOT NULL,
	`shots` text DEFAULT '[]' NOT NULL,
	`caption` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_creator_projects_user_time` ON `creator_projects` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_creator_projects_user_status` ON `creator_projects` (`user_id`,`status`);