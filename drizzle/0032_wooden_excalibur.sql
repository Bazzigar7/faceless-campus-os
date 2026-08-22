CREATE TABLE `xp_proofs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`mission_key` text NOT NULL,
	`mission_type` text NOT NULL,
	`chain` text DEFAULT 'ethereum' NOT NULL,
	`wallet_address` text NOT NULL,
	`transaction_hash` text NOT NULL,
	`xp_amount` integer NOT NULL,
	`status` text DEFAULT 'verified' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_xp_proofs_user_mission` ON `xp_proofs` (`user_id`,`mission_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_xp_proofs_transaction` ON `xp_proofs` (`transaction_hash`);--> statement-breakpoint
CREATE INDEX `idx_xp_proofs_user_status` ON `xp_proofs` (`user_id`,`status`);