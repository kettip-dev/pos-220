-- Business Groups (Phase 1)
--
-- Lets a Super Admin group multiple independent businesses (tenants) under one
-- organisational umbrella, e.g. "Pizza Hub" containing the Ahmedabad, Rajkot,
-- Surat and Vadodara tenants.
--
-- This is an organisational relationship ONLY. Every tenant remains a fully
-- independent tenant: auth, tenant_id isolation, users, orders, inventory,
-- settings, reports, billing and notifications are all untouched. Nothing
-- outside the Super Admin business-groups module reads `business_group_id`,
-- so existing behaviour is unchanged for every tenant (the column defaults to
-- NULL for all existing rows).

CREATE TABLE IF NOT EXISTS `business_groups` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(500) DEFAULT NULL,
  -- superadmins.email of the Super Admin who created the group. Intentionally
  -- not a foreign key so removing a Super Admin never cascades into groups.
  `created_by` VARCHAR(255) DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  -- One group name per platform; also backs the case-insensitive duplicate
  -- check in business_group.service.js (utf8mb4_0900_ai_ci is case-insensitive).
  UNIQUE KEY `business_groups_name_unique` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- A business belongs to at most ONE group; a group holds MANY businesses.
-- ON DELETE SET NULL is a safety net only — deleteBusinessGroupDB() explicitly
-- unlinks every member inside a transaction before removing the group, so
-- deleting a group never deletes a tenant.
ALTER TABLE `tenants`
  ADD COLUMN `business_group_id` INT DEFAULT NULL,
  ADD KEY `tenants_business_group_id` (`business_group_id`),
  ADD CONSTRAINT `tenants_business_group_id_fk`
    FOREIGN KEY (`business_group_id`) REFERENCES `business_groups` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
