CREATE TABLE `passport_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`share_slug` text NOT NULL,
	`is_public` integer DEFAULT false NOT NULL,
	`headline` text DEFAULT 'Blockchain learner · Onchain builder · Creator' NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_passport_profiles_user` ON `passport_profiles` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_passport_profiles_slug` ON `passport_profiles` (`share_slug`);--> statement-breakpoint
CREATE INDEX `idx_passport_profiles_public_time` ON `passport_profiles` (`is_public`,`updated_at`);