-- Firebase (FCM) configuration
-- Platform-global, superadmin-managed storage for the Firebase Admin SDK
-- service account. Exactly ONE row (id = 1) exists: the platform uses a
-- single Firebase project for all tenants because FCM device tokens are
-- issued against the Firebase project baked into the mobile app builds.
-- Tenant-specific Firebase projects are intentionally NOT supported.
--
-- encrypted_service_account holds the service account JSON encrypted with
-- the existing AES-256-GCM utility (src/utils/crypto.js), serialized as
-- {"iv","content","tag"}. Credentials are never stored in plain text.

CREATE TABLE IF NOT EXISTS firebase_config (
  id INT PRIMARY KEY, -- always 1 (single global row)
  encrypted_service_account TEXT NULL,
  -- Kept out of the encrypted blob so status can be shown/toggled without decrypting.
  project_id VARCHAR(255) NULL,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  updated_by VARCHAR(255) NULL, -- references superadmins.username
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
