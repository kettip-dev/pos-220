-- Fix service_requests user-attribution columns.
--
-- The original service_requests table declared raised_by_user_id / ack_by_user_id /
-- resolved_by_user_id as INT, assuming the `users` table had an integer `id`.
-- It does not: the `users` primary key is `username` VARCHAR(255). As a result:
--   * the listServiceRequestsDB JOIN (... ON sr.ack_by_user_id = u.id) crashed
--     with "Unknown column 'u.id'", and
--   * ack/resolve/cancel wrote NULL (req.user.id is undefined; the JWT carries
--     username, not id).
--
-- Widen the attribution columns to VARCHAR so they can store the username that
-- the application actually has. Existing values are all NULL, so this is safe.

ALTER TABLE service_requests
  MODIFY COLUMN raised_by_user_id   VARCHAR(255) NULL,
  MODIFY COLUMN ack_by_user_id      VARCHAR(255) NULL,
  MODIFY COLUMN resolved_by_user_id VARCHAR(255) NULL;

-- Same INT-vs-username problem in waiter_zone_assignments.user_id. The unique
-- key uq_tenant_user_floor includes user_id, so it must be dropped before the
-- column type change and recreated after. Table is empty, so this is safe.
ALTER TABLE waiter_zone_assignments DROP INDEX uq_tenant_user_floor;
ALTER TABLE waiter_zone_assignments MODIFY COLUMN user_id VARCHAR(255) NOT NULL;
ALTER TABLE waiter_zone_assignments ADD UNIQUE KEY uq_tenant_user_floor (tenant_id, user_id, floor);
