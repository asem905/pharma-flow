/*
  Warnings:

  - You are about to drop the column `failure_reason` on the `payments` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `payments` DROP COLUMN `failure_reason`,
    MODIFY `method` ENUM('CASH_ON_DELIVERY', 'VISA', 'MASTERCARD', 'BUDGET_CREDITS') NOT NULL;

-- CreateTable
CREATE TABLE `payment_failures` (
    `id` VARCHAR(191) NOT NULL,
    `payment_id` VARCHAR(36) NOT NULL,
    `original_idempotency_key` VARCHAR(100) NOT NULL,
    `failure_reason` VARCHAR(255) NULL,
    `refund_amount` DECIMAL(10, 2) NULL,
    `refund_status` ENUM('PENDING', 'REFUNDED') NULL,
    `refund_attempts` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `payment_failures_payment_id_key`(`payment_id`),
    INDEX `payment_failures_original_idempotency_key_idx`(`original_idempotency_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `payment_failures` ADD CONSTRAINT `payment_failures_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
