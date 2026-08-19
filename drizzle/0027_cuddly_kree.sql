CREATE TABLE `builder_project_members` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'Contributor' NOT NULL,
	`status` text DEFAULT 'invited' NOT NULL,
	`invited_by` text NOT NULL,
	`invited_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`responded_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `builder_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_builder_project_members_project_user` ON `builder_project_members` (`project_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_builder_project_members_user_status` ON `builder_project_members` (`user_id`,`status`);