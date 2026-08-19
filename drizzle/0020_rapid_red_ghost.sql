ALTER TABLE `creator_projects` ADD `campaign_id` text REFERENCES campaigns(id);--> statement-breakpoint
ALTER TABLE `creator_projects` ADD `review_status` text DEFAULT 'not_requested' NOT NULL;--> statement-breakpoint
ALTER TABLE `creator_projects` ADD `review_notes` text;--> statement-breakpoint
ALTER TABLE `creator_projects` ADD `reviewed_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `creator_projects` ADD `reviewed_at` text;