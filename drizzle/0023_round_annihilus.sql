CREATE TABLE `attendance_records` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`user_id` text NOT NULL,
	`checked_in_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `attendance_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_attendance_records_session_user` ON `attendance_records` (`session_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_attendance_records_user_time` ON `attendance_records` (`user_id`,`checked_in_at`);--> statement-breakpoint
CREATE TABLE `attendance_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`cohort_id` text NOT NULL,
	`title` text NOT NULL,
	`host` text DEFAULT 'Faceless' NOT NULL,
	`check_in_code` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`expires_at` text NOT NULL,
	`opened_by` text NOT NULL,
	`opened_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`closed_at` text,
	FOREIGN KEY (`cohort_id`) REFERENCES `cohorts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`opened_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_attendance_sessions_code` ON `attendance_sessions` (`check_in_code`);--> statement-breakpoint
CREATE INDEX `idx_attendance_sessions_cohort_status` ON `attendance_sessions` (`cohort_id`,`status`);