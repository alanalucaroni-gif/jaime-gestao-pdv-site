CREATE TABLE `deliverySettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`baseFee` decimal(10,2) NOT NULL,
	`perKm` decimal(10,2) NOT NULL,
	`maxRadius` decimal(10,2) NOT NULL,
	`minimumOrder` decimal(10,2) NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deliverySettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`platform` varchar(60) NOT NULL,
	`status` enum('connected','pending','available') NOT NULL DEFAULT 'available',
	`credentialsRef` varchar(120),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integrations_id` PRIMARY KEY(`id`),
	CONSTRAINT `integrations_platform_unique` UNIQUE(`platform`)
);
--> statement-breakpoint
CREATE TABLE `motoboys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`phone` varchar(40) NOT NULL,
	`status` enum('online','offline','delivering') NOT NULL DEFAULT 'offline',
	`deliveries` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `motoboys_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orderItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int,
	`name` varchar(160) NOT NULL,
	`quantity` int NOT NULL,
	`unitPrice` decimal(10,2) NOT NULL,
	CONSTRAINT `orderItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(40) NOT NULL,
	`externalId` varchar(120),
	`source` enum('site','ifood','whatsapp','marketplace','balcao') NOT NULL,
	`customerName` varchar(160) NOT NULL,
	`address` text,
	`deliveryType` enum('delivery','pickup','counter') NOT NULL,
	`status` enum('analysis','production','ready','completed','cancelled') NOT NULL DEFAULT 'analysis',
	`paymentMethod` varchar(40) NOT NULL,
	`paymentStatus` enum('pending','paid','failed','cash_on_delivery') NOT NULL DEFAULT 'pending',
	`subtotal` decimal(10,2) NOT NULL,
	`deliveryFee` decimal(10,2) NOT NULL,
	`total` decimal(10,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_publicId_unique` UNIQUE(`publicId`)
);
--> statement-breakpoint
CREATE TABLE `paymentSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pix` int NOT NULL DEFAULT 1,
	`card` int NOT NULL DEFAULT 1,
	`cashOnDelivery` int NOT NULL DEFAULT 1,
	`onlineProvider` varchar(40) NOT NULL DEFAULT 'Não conectado',
	`onlineEnabled` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paymentSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `productionSheets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product` varchar(160) NOT NULL,
	`yieldText` varchar(80) NOT NULL,
	`prepTime` varchar(40) NOT NULL,
	`cost` decimal(10,2) NOT NULL,
	`ingredientsJson` text NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `productionSheets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`slug` varchar(180) NOT NULL,
	`category` varchar(40) NOT NULL,
	`description` text NOT NULL,
	`price` decimal(10,2) NOT NULL,
	`available` int NOT NULL DEFAULT 1,
	`accent` varchar(40) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `stockItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`detail` varchar(255) NOT NULL,
	`current` decimal(10,3) NOT NULL,
	`minimum` decimal(10,3) NOT NULL,
	`unit` varchar(20) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stockItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stockMovements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stockItemId` int NOT NULL,
	`type` enum('in','out','adjustment') NOT NULL,
	`quantity` decimal(10,3) NOT NULL,
	`reason` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stockMovements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stripeEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` varchar(160) NOT NULL,
	`eventType` varchar(100) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stripeEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `stripeEvents_eventId_unique` UNIQUE(`eventId`)
);
