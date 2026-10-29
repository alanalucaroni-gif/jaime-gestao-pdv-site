CREATE TABLE `purchaseItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`stockItemId` int,
	`itemName` varchar(160) NOT NULL,
	`quantity` decimal(10,3) NOT NULL,
	`unit` varchar(20) NOT NULL,
	CONSTRAINT `purchaseItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchaseRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(40) NOT NULL,
	`status` enum('draft','sent','quoting','awarded','ordered','received') NOT NULL DEFAULT 'draft',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchaseRequests_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchaseRequests_publicId_unique` UNIQUE(`publicId`)
);
--> statement-breakpoint
CREATE TABLE `supplierQuoteItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quoteId` int NOT NULL,
	`purchaseItemId` int NOT NULL,
	`unitPrice` decimal(10,2) NOT NULL,
	`available` int NOT NULL DEFAULT 1,
	CONSTRAINT `supplierQuoteItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `supplierQuotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`supplierId` int NOT NULL,
	`token` varchar(80) NOT NULL,
	`status` enum('sent','responded','awarded','rejected') NOT NULL DEFAULT 'sent',
	`total` decimal(10,2) NOT NULL DEFAULT '0',
	`notes` text,
	`submittedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `supplierQuotes_id` PRIMARY KEY(`id`),
	CONSTRAINT `supplierQuotes_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`whatsapp` varchar(30) NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `stockItems` ADD `lastCost` decimal(10,2) DEFAULT '0' NOT NULL;