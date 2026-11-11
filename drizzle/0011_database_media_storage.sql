CREATE TABLE `media_files` (
  `id` int NOT NULL AUTO_INCREMENT,
  `storageKey` varchar(255) NOT NULL,
  `contentType` varchar(100) NOT NULL,
  `dataBase64` mediumtext NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `media_files_id` PRIMARY KEY(`id`),
  CONSTRAINT `media_files_storageKey_unique` UNIQUE(`storageKey`)
);
