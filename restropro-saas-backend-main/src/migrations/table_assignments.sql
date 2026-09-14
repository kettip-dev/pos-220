-- Table assignments
-- Lets a manager assign specific tables to a waiter or captain from the web.
-- The waiter/captain apps use this to show "My Tables" (assigned to me) vs
-- "All Tables". Assignment is purely a filter/ownership hint — anyone can still
-- act on any table; this just lets professional venues run a 1-staff-per-N-tables
-- model while open/QR venues simply leave everything unassigned.

CREATE TABLE IF NOT EXISTS table_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  table_id INT NOT NULL,
  user_id VARCHAR(255) NOT NULL, -- references users.username
  role ENUM('waiter','captain') NOT NULL DEFAULT 'waiter',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  -- One staff member per (table, role): a table has at most one waiter and one
  -- captain. Reassigning replaces the previous holder for that role.
  UNIQUE KEY uq_tenant_table_role (tenant_id, table_id, role),
  INDEX idx_tenant_user (tenant_id, user_id),
  INDEX idx_tenant_table (tenant_id, table_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
