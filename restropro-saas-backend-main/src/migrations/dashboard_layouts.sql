-- ─────────────────────────────────────────────────────────────────────────────
-- Customizable Dashboard — per-user widget layouts
--
-- Stores each user's saved dashboard composition as a JSON document.
-- Tenant + user scoped (user identified by username, since the JWT payload
-- does not include a numeric user id — see backend/src/controllers/auth.controller.js).
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS dashboard_layouts;

CREATE TABLE dashboard_layouts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  username VARCHAR(120) NOT NULL,
  name VARCHAR(120) NOT NULL DEFAULT 'My Dashboard',
  is_default TINYINT(1) NOT NULL DEFAULT 1,
  template_key VARCHAR(64) NULL,
  layout_json JSON NOT NULL,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_layout (tenant_id, username, name),
  INDEX idx_tenant_user (tenant_id, username),
  INDEX idx_user_default (username, is_default)
);
