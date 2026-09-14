ALTER TABLE `invoices`
  ADD COLUMN `discount_type` ENUM('fixed', 'percentage') NULL AFTER `service_charge_total`,
  ADD COLUMN `discount_value` DECIMAL(10,2) DEFAULT 0 AFTER `discount_type`,
  ADD COLUMN `discount_total` DECIMAL(10,2) DEFAULT 0 AFTER `discount_value`;

