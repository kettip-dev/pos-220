-- Devices (push notification tokens)
-- One row per installed app instance. A user can be signed in on several
-- devices (Android phone, iPhone, tablet) and each device has its own FCM
-- token, so tokens live here and NOT on the users table.
--
-- Only the waiter app registers device tokens today (kitchen/captain apps
-- trigger notifications through backend APIs and never receive pushes), but
-- the table is app-agnostic on purpose.

CREATE TABLE IF NOT EXISTS devices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tenant_id INT NOT NULL,
  user_id VARCHAR(255) NOT NULL, -- references users.username (the users PK is username, not id)
  platform VARCHAR(50) NOT NULL, -- 'android' | 'ios'
  -- FCM registration tokens are ~160 chars today; VARCHAR (not TEXT) so the
  -- unique index below works without a prefix. A token identifies exactly one
  -- app install, so re-registering the same token moves it to the new user.
  fcm_token VARCHAR(512) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_fcm_token (fcm_token),
  INDEX idx_tenant_user (tenant_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
