CREATE TABLE `supplier_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sourceName` varchar(255) NOT NULL,
  `displayName` varchar(255) NOT NULL,
  `imageUrl` text,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `supplier_categories_id` PRIMARY KEY(`id`),
  CONSTRAINT `supplier_categories_sourceName_unique` UNIQUE(`sourceName`)
);
