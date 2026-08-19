DROP INDEX `idx_cohort_members_user`;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_cohort_members_user` ON `cohort_members` (`user_id`);--> statement-breakpoint
ALTER TABLE `cohorts` ADD `join_code` text;--> statement-breakpoint
ALTER TABLE `cohorts` ADD `enrollment_open` integer DEFAULT true NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_cohorts_join_code` ON `cohorts` (`join_code`);