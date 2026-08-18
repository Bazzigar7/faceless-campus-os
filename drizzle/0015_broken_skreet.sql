CREATE TABLE `classroom_session_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'working' NOT NULL,
	`proof_label` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`session_id`) REFERENCES `classroom_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_classroom_activity_session_user` ON `classroom_session_activity` (`session_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_classroom_activity_session_status` ON `classroom_session_activity` (`session_id`,`status`);