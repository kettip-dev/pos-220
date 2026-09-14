-- Business Group Owners — reversible assignment (Phase 2 fix)
--
-- Promoting a user to Business Group Owner must be fully reversible. Previously
-- the promotion overwrote `role` and cleared `tenant_id` and `scope`, which
-- destroyed the user's home business and permissions: removing the owner again
-- left an account with no role, no business and no scope that could not log in
-- anywhere.
--
-- The promotion now preserves `tenant_id` and `scope` untouched and records the
-- role it replaced here, so removing an owner restores exactly what they were.
--
-- Keeping `tenant_id` on an owner grants no access: getGroupOwnerAuthContextDB()
-- never reads users.tenant_id — it joins the ACTIVE business from the token
-- with `t.business_group_id = u.business_group_id`. Sign-in and switch-business
-- both only ever select a business inside the owner's group, so the retained
-- home business is inert for authorization.

ALTER TABLE `users`
  -- Role held before promotion to group_owner; NULL for everyone who is not
  -- currently a group owner. Restored verbatim on removal.
  ADD COLUMN `previous_role` ENUM('admin','user') DEFAULT NULL;
