CREATE TABLE `builder_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`chain` text DEFAULT 'ethereum' NOT NULL,
	`use_case` text DEFAULT 'other' NOT NULL,
	`problem` text NOT NULL,
	`audience` text NOT NULL,
	`solution` text NOT NULL,
	`milestones` text DEFAULT '[]' NOT NULL,
	`contract_reference` text,
	`demo_url` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`review_notes` text,
	`reviewed_by` text,
	`reviewed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_builder_projects_user_time` ON `builder_projects` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_builder_projects_status_time` ON `builder_projects` (`status`,`updated_at`);