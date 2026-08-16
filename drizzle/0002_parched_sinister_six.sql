CREATE TABLE `lesson_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`course` text NOT NULL,
	`lesson_id` integer NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`position_seconds` integer DEFAULT 0 NOT NULL,
	`duration_seconds` integer DEFAULT 0 NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_lesson_progress_user_course_lesson` ON `lesson_progress` (`user_id`,`course`,`lesson_id`);--> statement-breakpoint
CREATE INDEX `idx_lesson_progress_user_status` ON `lesson_progress` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_lesson_progress_course_status` ON `lesson_progress` (`course`,`status`);