-- Invoice void (audit-friendly invoice removal)
--
-- VOID: flips `status` to 'VOID'. Invoice stays exactly where it is, same
-- id/number, still visible everywhere for audit. Reverses whatever
-- inventory this invoice's orders actually deducted. Never deletes a row or
-- reuses `invoices.id` (the per-tenant invoice number, see
-- invoice_sequences).

-- ---------------------------------------------------------------------------
-- 1. Invoice void columns
-- ---------------------------------------------------------------------------
ALTER TABLE invoices
  ADD COLUMN status ENUM('COMPLETED','VOID') NOT NULL DEFAULT 'COMPLETED' AFTER created_by,
  ADD COLUMN voided_at DATETIME NULL AFTER status,
  ADD COLUMN voided_by VARCHAR(255) NULL AFTER voided_at,
  ADD COLUMN void_reason VARCHAR(500) NULL AFTER voided_by,
  ADD KEY invoices_voided_by_idx (voided_by),
  ADD KEY invoices_tenant_status_idx (tenant_id, status),
  ADD CONSTRAINT invoices_voided_by_fk FOREIGN KEY (voided_by) REFERENCES users (username) ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Attribute inventory deductions to the order that caused them
-- ---------------------------------------------------------------------------
-- Voiding an invoice must reverse exactly what its orders deducted, not
-- recompute from today's recipe (recipes can change after the order was
-- placed). `order_id` lets a void look up the real historical OUT rows.
-- Rows written before this migration have order_id = NULL, so invoices
-- created before this ships can't have their inventory auto-reversed on
-- void -- the void still succeeds, it just skips the inventory step for
-- those. No FK, matching the existing loose-reference style already used
-- for orders.invoice_id.
ALTER TABLE inventory_logs
  ADD COLUMN order_id INT NULL AFTER inventory_item_id,
  ADD KEY inventory_logs_tenant_order_idx (tenant_id, order_id);

-- ---------------------------------------------------------------------------
-- 3. Invoice audit log
-- ---------------------------------------------------------------------------
-- No generic audit_log exists anywhere in this codebase; this one is scoped
-- to invoices only, following the same append-only "domain log" shape as
-- inventory_logs. invoice_number is redundant with invoice_id today (the
-- invoice number IS invoices.id) but is kept as its own column so the audit
-- trail stays correct even if that ever changes.
CREATE TABLE IF NOT EXISTS invoice_audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  invoice_id INT NOT NULL,
  invoice_number INT NOT NULL,
  action ENUM('VOID') NOT NULL,
  performed_by VARCHAR(255) NULL,
  reason VARCHAR(500) NOT NULL,
  previous_status VARCHAR(20) NOT NULL,
  new_status VARCHAR(20) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY invoice_audit_log_tenant_invoice_idx (tenant_id, invoice_id),
  CONSTRAINT invoice_audit_log_invoice_fk FOREIGN KEY (invoice_id, tenant_id) REFERENCES invoices (id, tenant_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT invoice_audit_log_performed_by_fk FOREIGN KEY (performed_by) REFERENCES users (username) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- 4. Grant the new scope to every plan that already grants INVOICES
-- ---------------------------------------------------------------------------
-- authorize() checks user.plan_features (this table's `features` JSON
-- array) before it ever checks role, so a brand-new scope string is
-- unusable by anyone -- including admins -- until it's present here. Void
-- is a sub-permission of the existing invoicing feature, so any plan that
-- already grants INVOICES gets it too. JSON_CONTAINS-guarded, so rerunning
-- this migration is a no-op the second time.
UPDATE plans
SET features = JSON_ARRAY_APPEND(features, '$', 'VOID_INVOICES')
WHERE JSON_CONTAINS(features, '"INVOICES"')
  AND NOT JSON_CONTAINS(features, '"VOID_INVOICES"');
