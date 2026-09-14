-- Dual-role Business Group Owners — protect Business Admin accounts
--
-- `users.business_group_id` marks group-owner CAPABILITY. Under the original
-- design only DEDICATED owner accounts carried it, so ON DELETE CASCADE was
-- harmless: deleting a group deleted the accounts that existed only to own it.
--
-- Under the dual-role model a Business Admin carries it too — they keep their
-- role, their business and their login and additionally own a group. With
-- CASCADE in place, deleting a business group would DELETE THAT ADMIN'S ACCOUNT
-- outright, taking their login with it and setting `orders.created_by` /
-- `invoices.created_by` to NULL through their own FKs.
--
-- SET NULL is the correct rule for a capability column: losing the group means
-- losing the capability, never the account. `business_group.service` deletes the
-- dedicated owner accounts explicitly, so that behaviour is unchanged — it is
-- now stated in code rather than implied by schema configuration.
--
-- Safe to re-run: the constraint is dropped only if present.

SET @fk_exists := (
  SELECT COUNT(*)
  FROM information_schema.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND CONSTRAINT_NAME = 'users_business_group_id_fk'
);

SET @sql := IF(
  @fk_exists > 0,
  'ALTER TABLE users DROP FOREIGN KEY users_business_group_id_fk',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE users
  ADD CONSTRAINT users_business_group_id_fk
  FOREIGN KEY (business_group_id) REFERENCES business_groups (id)
  ON DELETE SET NULL ON UPDATE CASCADE;
