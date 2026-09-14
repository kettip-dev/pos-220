-- Service requests table
-- Captures table calls (water, bill, cutlery, etc.) raised from the QR menu,
-- captain app, or web POS. Consumed and resolved by the waiter app.

CREATE TABLE IF NOT EXISTS service_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  table_id INT NULL,
  table_title VARCHAR(100) NULL,
  floor VARCHAR(100) NULL,
  order_id INT NULL,
  reason ENUM('water','bill','order_more','cutlery','condiments','napkins','clean_table','complaint','captain','other') NOT NULL DEFAULT 'other',
  notes VARCHAR(500) NULL,
  status ENUM('open','acknowledged','resolved','cancelled') NOT NULL DEFAULT 'open',
  raised_by ENUM('customer','captain','waiter','manager','qrmenu') NOT NULL DEFAULT 'customer',
  -- User attribution references users.username (the users PK is username, not id).
  raised_by_user_id VARCHAR(255) NULL,
  ack_by_user_id VARCHAR(255) NULL,
  ack_at TIMESTAMP NULL,
  resolved_by_user_id VARCHAR(255) NULL,
  resolved_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_tenant_status (tenant_id, status),
  INDEX idx_tenant_table (tenant_id, table_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Waiter zone assignments
-- Lets waiters self-assign floor zones during shift; used to filter the floor view.

CREATE TABLE IF NOT EXISTS waiter_zone_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  user_id VARCHAR(255) NOT NULL, -- references users.username
  floor VARCHAR(100) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tenant_user_floor (tenant_id, user_id, floor),
  INDEX idx_tenant_active (tenant_id, active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
