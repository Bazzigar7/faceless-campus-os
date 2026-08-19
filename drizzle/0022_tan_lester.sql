CREATE TABLE `cohort_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`cohort_id` text NOT NULL,
	`course` text NOT NULL,
	`lesson_id` integer NOT NULL,
	`title` text NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`due_at` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cohort_id`) REFERENCES `cohorts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_cohort_assignments_cohort_lesson` ON `cohort_assignments` (`cohort_id`,`course`,`lesson_id`);--> statement-breakpoint
CREATE INDEX `idx_cohort_assignments_cohort_status` ON `cohort_assignments` (`cohort_id`,`status`);