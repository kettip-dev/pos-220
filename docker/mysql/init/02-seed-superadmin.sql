-- Seed default Super Admin user
-- Default credentials:
-- Email: admin@example.com
-- Password: Admin@123456

INSERT INTO `superadmins` (`email`, `password`, `name`)
VALUES ('admin@example.com', '$2b$10$y5kF5DniPGCfHvRUvNJx..QLqc6HYa5qKBCfjGo00UUbd2uoc2cpa', 'Super Admin')
ON DUPLICATE KEY UPDATE `password` = VALUES(`password`), `name` = VALUES(`name`);
