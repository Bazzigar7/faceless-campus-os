ALTER TABLE `partner_lab_teams` ADD `character_key` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `partner_lab_teams` ADD `token_pitch` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `partner_lab_teams` ADD `initial_buy_eth` text DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `partner_lab_teams` ADD `curve_progress_bps` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `partner_lab_teams` ADD `graduation_tx_hash` text;--> statement-breakpoint
ALTER TABLE `partner_lab_teams` ADD `feedback_reference` text;--> statement-breakpoint
ALTER TABLE `partner_lab_teams` ADD `feedback_submitted_at` text;