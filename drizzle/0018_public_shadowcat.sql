ALTER TABLE `partner_drops` ADD `reward_kind` text DEFAULT 'credential' NOT NULL;--> statement-breakpoint
ALTER TABLE `partner_drops` ADD `reward_asset_id` text;