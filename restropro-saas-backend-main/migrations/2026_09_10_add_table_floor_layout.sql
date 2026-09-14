-- Add visual floor layout columns to store_tables
ALTER TABLE store_tables
  ADD COLUMN pos_x INT DEFAULT NULL,
  ADD COLUMN pos_y INT DEFAULT NULL,
  ADD COLUMN shape VARCHAR(20) DEFAULT 'round',
  ADD COLUMN rotation INT DEFAULT 0;

-- Create store_floor_layouts table for floor-level settings (e.g. cashier station position)
CREATE TABLE IF NOT EXISTS store_floor_layouts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  floor VARCHAR(50) NOT NULL,
  show_cashier TINYINT(1) DEFAULT 1,
  cashier_x INT DEFAULT 80,
  cashier_y INT DEFAULT 300,
  cashier_w INT DEFAULT 90,
  cashier_h INT DEFAULT 200,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY tenant_floor_idx (tenant_id, floor),
  INDEX idx_tenant (tenant_id),
  CONSTRAINT store_floor_layouts_ibfk_1 FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
