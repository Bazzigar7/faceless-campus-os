CREATE TABLE `classroom_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`quest` text NOT NULL,
	`instructions` text NOT NULL,
	`status` text DEFAULT 'live' NOT NULL,
	`opened_by` text NOT NULL,
	`started_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`ended_at` text,
	FOREIGN KEY (`opened_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_classroom_sessions_status_time` ON `classroom_sessions` (`status`,`started_at`);