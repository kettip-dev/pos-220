-- Business Group Owners (Phase 2)
--
-- Extends the EXISTING users table with a new role instead of introducing a
-- second user/auth system. A Business Group Owner is a normal row in `users`
-- that has no tenant_id of its own and instead points at a business group.
--
--   Business Admin / Staff : tenant_id = <business>, business_group_id = NULL
--   Business Group Owner   : tenant_id = NULL,       business_group_id = <group>
--   Super Admin            : lives in the separate `superadmins` table
--
-- Backward compatibility: both new columns default to NULL and the role enum
-- only GAINS a value, so every existing user row keeps its exact behaviour.
-- Nothing outside the group-owner code paths reads these columns.

ALTER TABLE `users`
  -- Additive only: 'admin' and 'user' keep their meaning and the 'user' default.
  MODIFY COLUMN `role` ENUM('admin','user','group_owner') DEFAULT 'user',

  -- The group this user owns. NULL for every ordinary tenant user.
  ADD COLUMN `business_group_id` INT DEFAULT NULL,

  -- Access level across the group's businesses. NULL for non-owners.
  --   'read'  -> may view only; every create/update/delete is rejected
  --   'write' -> may manage business-level data in the selected business
  ADD COLUMN `group_permission_level` ENUM('read','write') DEFAULT NULL,

  ADD KEY `users_business_group_id` (`business_group_id`),

  -- SET NULL, deliberately not CASCADE: deleting a business group must never
  -- delete user accounts. An owner left with business_group_id = NULL fails
  -- closed — verifyGroupOwnerScope() denies every request until a Super Admin
  -- reassigns them.
  ADD CONSTRAINT `users_business_group_id_fk`
    FOREIGN KEY (`business_group_id`) REFERENCES `business_groups` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
