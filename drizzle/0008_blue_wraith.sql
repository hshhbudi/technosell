ALTER TABLE `orders` ADD `supplierOrderUuid` varchar(36);--> statement-breakpoint
ALTER TABLE `orders` ADD `supplierOrderId` varchar(100);--> statement-breakpoint
ALTER TABLE `orders` ADD `supplierStatus` varchar(32);--> statement-breakpoint
ALTER TABLE `orders` ADD `supplierAttempts` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `supplierLastError` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `supplierRefunded` boolean DEFAULT false NOT NULL;