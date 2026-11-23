ALTER TABLE users
ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'USER' AFTER password,
ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 AFTER role,
ADD CONSTRAINT chk_user_role CHECK (role IN ('USER', 'ADMIN'));

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);