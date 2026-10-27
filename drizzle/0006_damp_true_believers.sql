ALTER TABLE `customer_accounts` ADD `balanceCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `customerId` int;