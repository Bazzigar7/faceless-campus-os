CREATE TABLE `notification_reads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`notification_key` text NOT NULL,
	`read_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_notification_reads_user_key` ON `notification_reads` (`user_id`,`notification_key`);--> statement-breakpoint
CREATE INDEX `idx_notification_reads_user_time` ON `notification_reads` (`user_id`,`read_at`);