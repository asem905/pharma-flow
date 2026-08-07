-- CreateTable
CREATE TABLE `refund_ledger` (
    `id` VARCHAR(191) NOT NULL,
    `refund_key` VARCHAR(255) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    `amount` DOUBLE NOT NULL,
    `applied_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refund_ledger_refund_key_key`(`refund_key`),
    INDEX `refund_ledger_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
