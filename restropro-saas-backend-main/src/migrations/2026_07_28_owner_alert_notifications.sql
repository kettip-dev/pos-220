-- Owner App alert notifications (DAY_END_RECONCILIATION, LOW_STOCK)
--
-- Two small state tables that make the alerts idempotent. Both are pure
-- bookkeeping: dropping them only causes a re-alert, never data loss.

-- ---------------------------------------------------------------------------
-- 1. Scheduled notification dispatch log
-- ---------------------------------------------------------------------------
-- "Send only one notification per tenant per day" is enforced by the UNIQUE
-- key, not by scheduler bookkeeping: the scheduler does an INSERT IGNORE and
-- only sends when it inserted the row. That keeps the guarantee across process
-- restarts, overlapping ticks, and (should it ever happen) multiple app
-- instances sharing one database.
CREATE TABLE IF NOT EXISTS notification_dispatch_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  notification_type VARCHAR(64) NOT NULL, -- notification.service NOTIFICATION_TYPES key
  dispatch_date DATE NOT NULL,            -- business date the run covers (DB CURDATE())
  sent_count INT NOT NULL DEFAULT 0,      -- devices the push reached (0 = claimed but skipped/failed)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_dispatch (tenant_id, notification_type, dispatch_date),
  CONSTRAINT fk_dispatch_log_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- 2. Open low-stock alerts
-- ---------------------------------------------------------------------------
-- One row per inventory item the owner has already been alerted about. The row
-- is inserted (INSERT IGNORE, inside the same transaction as the stock change)
-- when an item crosses to <= its threshold, and deleted as soon as the item is
-- replenished back above it. "Row exists" therefore means "already alerted,
-- stay quiet" — which is exactly the de-duplication rule, and it survives
-- restarts and concurrent stock updates.
--
-- ON DELETE CASCADE against inventory_items means deleting an item also clears
-- its alert, so re-creating a low item alerts again.
CREATE TABLE IF NOT EXISTS inventory_low_stock_alerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  inventory_item_id INT NOT NULL,
  quantity DECIMAL(10,4) NOT NULL,              -- snapshot when the alert opened
  min_quantity_threshold DECIMAL(10,4) NOT NULL,
  notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_low_stock_alert (tenant_id, inventory_item_id),
  CONSTRAINT fk_low_stock_alert_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_low_stock_alert_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
