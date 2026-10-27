CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNumber` varchar(32) NOT NULL,
	`items` text NOT NULL,
	`total` int NOT NULL,
	`customerName` varchar(160) NOT NULL,
	`phone` varchar(40) NOT NULL,
	`playerId` varchar(120),
	`serverId` varchar(120),
	`paymentMethod` enum('shamcash','other') NOT NULL DEFAULT 'shamcash',
	`paymentReference` varchar(160),
	`paymentStatus` enum('pending','confirmed','rejected') NOT NULL DEFAULT 'pending',
	`executionStatus` enum('pending','manual_processing','completed','failed') NOT NULL DEFAULT 'pending',
	`ownerNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_orderNumber_unique` UNIQUE(`orderNumber`)
);
