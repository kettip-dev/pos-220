-- Add firebase_uid and signup_provider columns (keep password column NOT NULL)
ALTER TABLE users ADD COLUMN firebase_uid VARCHAR(128) UNIQUE NULL;
ALTER TABLE users ADD COLUMN signup_provider VARCHAR(20) DEFAULT 'email';
