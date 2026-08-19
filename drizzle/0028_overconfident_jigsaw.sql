CREATE TABLE `builder_project_reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`user_id` text NOT NULL,
	`kind` text DEFAULT 'applaud' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `builder_projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_builder_project_reactions_project_user_kind` ON `builder_project_reactions` (`project_id`,`user_id`,`kind`);--> statement-breakpoint
CREATE INDEX `idx_builder_project_reactions_project_time` ON `builder_project_reactions` (`project_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `builder_projects` ADD `featured_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `builder_projects` ADD `featured_at` text;