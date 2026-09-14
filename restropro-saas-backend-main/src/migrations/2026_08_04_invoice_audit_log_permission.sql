-- Invoice Audit Log viewing permission
--
-- The invoice_audit_log table (2026_08_03_invoice_void_soft_delete.sql) has
-- been written to since Void/Delete shipped, but nothing could read it --
-- there was no permission gating a read endpoint. This adds that permission.
--
-- Business Owner and Business Admin both resolve to role='admin' in this
-- schema (there is no separate owner concept) and already bypass scope
-- checks in authorize(). Every other user needs VIEW_INVOICE_AUDIT_LOG
-- explicitly.
--
-- Same trap as before: authorize() checks user.plan_features (this table's
-- `features` JSON array) before it ever checks role, so a brand-new scope
-- string is unusable by anyone -- including admins -- until it's present
-- here. Viewing the audit log is a sub-permission of the existing invoicing
-- feature, so any plan that already grants INVOICES gets it too.
-- JSON_CONTAINS-guarded, so rerunning this migration is a no-op the second
-- time.
UPDATE plans
SET features = JSON_ARRAY_APPEND(features, '$', 'VIEW_INVOICE_AUDIT_LOG')
WHERE JSON_CONTAINS(features, '"INVOICES"')
  AND NOT JSON_CONTAINS(features, '"VIEW_INVOICE_AUDIT_LOG"');
2