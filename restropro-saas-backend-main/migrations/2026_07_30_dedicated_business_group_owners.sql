-- Dedicated Business Group Owner accounts (Phase 2 architecture change)
--
-- A Business Group Owner is now a DEDICATED account in the existing `users`
-- table, created by the Super Admin. Business Admins and Staff are never
-- converted into owners, so nothing about an existing user is ever rewritten.
--
--   Business Group Owner : role='group_owner', tenant_id=NULL,     business_group_id=<group>
--   Business Admin       : role='admin',       tenant_id=<tenant>, business_group_id=NULL
--   Staff                : role='user',        tenant_id=<tenant>, business_group_id=NULL
--
-- Existing Business Admin and Staff rows are untouched: `status` defaults to
-- 'active' and `active_tenant_id` defaults to NULL, and neither column is read
-- for those roles.

ALTER TABLE `users`
  -- Account status. Enforced at login for group_owner accounts ONLY, so the
  -- sign-in behaviour of Super Admins, Business Admins and Staff is unchanged.
  ADD COLUMN `status` ENUM('active','inactive') NOT NULL DEFAULT 'active',

  -- The business a group owner currently has selected in the Business Switcher.
  -- The active business is deliberately NOT carried in the JWT: it changes when
  -- the owner switches, so it lives here and is re-validated against the owner's
  -- group on every request. NULL for every non-owner role.
  ADD COLUMN `active_tenant_id` INT DEFAULT NULL,

  ADD KEY `users_active_tenant_id` (`active_tenant_id`),

  -- If the selected business is deleted the selection simply clears; sign-in
  -- then falls back to the first business in the group.
  ADD CONSTRAINT `users_active_tenant_id_fk`
    FOREIGN KEY (`active_tenant_id`) REFERENCES `tenants` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- `previous_role` existed only to undo the old "promote an existing user"
-- flow. Owners are dedicated accounts now, so there is no role to restore.
ALTER TABLE `users` DROP COLUMN `previous_role`;

-- business_group_id now CASCADEs. Previously SET NULL, because deleting a group
-- must never have deleted a repurposed Business Admin's account. Owner accounts
-- are dedicated and exist only to own their group, and the invariant is that
-- business_group_id is always populated — so deleting a group must delete its
-- owner accounts rather than leave rows that violate it.
ALTER TABLE `users` DROP FOREIGN KEY `users_business_group_id_fk`;
ALTER TABLE `users`
  ADD CONSTRAINT `users_business_group_id_fk`
    FOREIGN KEY (`business_group_id`) REFERENCES `business_groups` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
