CREATE TABLE `customer_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`displayName` varchar(120) NOT NULL,
	`email` varchar(320) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`phone` varchar(40),
	`freeFireId` varchar(120),
	`pubgId` varchar(120),
	`pubgServerId` varchar(120),
	`takaId` varchar(120),
	`bigoId` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `customer_accounts_email_unique` UNIQUE(`email`)
);
