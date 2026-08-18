CREATE TABLE `campus_transaction_queues` (
	`network` text PRIMARY KEY NOT NULL,
	`next_available_at` integer NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
