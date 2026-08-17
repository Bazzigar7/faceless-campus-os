CREATE TABLE `market_purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`collection_id` text NOT NULL,
	`buyer_user_id` text NOT NULL,
	`buyer_address` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`transaction_hash` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `testnet_launches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`buyer_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_market_purchases_tx` ON `market_purchases` (`transaction_hash`);--> statement-breakpoint
CREATE INDEX `idx_market_purchases_collection_time` ON `market_purchases` (`collection_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_market_purchases_buyer_time` ON `market_purchases` (`buyer_user_id`,`created_at`);