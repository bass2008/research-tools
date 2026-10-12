CREATE TABLE tariffs (
	id VARCHAR(16) NOT NULL, 
	name VARCHAR(64) NOT NULL, 
	price INTEGER NOT NULL, 
	scope TEXT NOT NULL, 
	period_days INTEGER, 
	PRIMARY KEY (id)
);
CREATE TABLE users (
	id INTEGER NOT NULL, 
	email VARCHAR(320) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, 
	last_seen_at DATETIME, 
	PRIMARY KEY (id)
);
CREATE UNIQUE INDEX ix_users_email ON users (email);
CREATE TABLE payment_sweeps (
	id INTEGER NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	started_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, 
	finished_at DATETIME, 
	checked INTEGER NOT NULL, 
	changed INTEGER NOT NULL, 
	log TEXT NOT NULL, 
	error VARCHAR(300), 
	PRIMARY KEY (id)
);
CREATE TABLE error_log (
	id INTEGER NOT NULL, 
	at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, 
	method VARCHAR(8) NOT NULL, 
	path VARCHAR(200) NOT NULL, 
	status INTEGER NOT NULL, 
	message VARCHAR(300) NOT NULL, 
	trace TEXT, 
	PRIMARY KEY (id)
);
CREATE INDEX ix_error_log_at ON error_log (at);
CREATE TABLE security_audit (
	id INTEGER NOT NULL, 
	at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, 
	action VARCHAR(16) NOT NULL, 
	outcome VARCHAR(16) NOT NULL, 
	email VARCHAR(320), 
	ip VARCHAR(64), 
	PRIMARY KEY (id)
);
CREATE INDEX ix_security_audit_outcome ON security_audit (outcome);
CREATE INDEX ix_security_audit_email ON security_audit (email);
CREATE INDEX ix_security_audit_at ON security_audit (at);
CREATE TABLE matrices (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	birth DATE NOT NULL, 
	sex VARCHAR(1) NOT NULL, 
	title VARCHAR(200), 
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);
CREATE INDEX ix_matrices_user_id ON matrices (user_id);
CREATE TABLE payments (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	tariff_body TEXT NOT NULL, 
	amount INTEGER NOT NULL, 
	matrix_id INTEGER, 
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, 
	paid_at DATETIME, 
	refunded_at DATETIME, 
	external_id VARCHAR(64) NOT NULL, 
	provider VARCHAR(16) DEFAULT 'mock' NOT NULL, 
	status VARCHAR(24) DEFAULT 'NEW' NOT NULL, 
	pay_url VARCHAR(300), 
	order_id VARCHAR(64), 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(matrix_id) REFERENCES matrices (id) ON DELETE SET NULL
);
CREATE INDEX ix_payments_order_id ON payments (order_id);
CREATE INDEX ix_payments_user_id ON payments (user_id);
CREATE UNIQUE INDEX ix_payments_external_id ON payments (external_id);
CREATE TABLE report_jobs (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	matrix_id INTEGER NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	locale VARCHAR(16) NOT NULL, 
	object_key VARCHAR(300), 
	size_bytes INTEGER, 
	error VARCHAR(300), 
	created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, 
	started_at DATETIME, 
	finished_at DATETIME, 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(matrix_id) REFERENCES matrices (id) ON DELETE CASCADE
);
CREATE INDEX ix_report_jobs_user_id ON report_jobs (user_id);
CREATE INDEX ix_report_jobs_matrix_id ON report_jobs (matrix_id);
CREATE TABLE entitlements (
	id INTEGER NOT NULL, 
	user_id INTEGER NOT NULL, 
	payment_id INTEGER, 
	scope TEXT NOT NULL, 
	matrix_id INTEGER, 
	starts_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL, 
	expires_at DATETIME, 
	revoked_at DATETIME, 
	note VARCHAR(120), 
	PRIMARY KEY (id), 
	FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	FOREIGN KEY(payment_id) REFERENCES payments (id) ON DELETE SET NULL, 
	FOREIGN KEY(matrix_id) REFERENCES matrices (id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX ux_entitlement_active_matrix ON entitlements (user_id, matrix_id) WHERE matrix_id IS NOT NULL AND revoked_at IS NULL;
CREATE INDEX ix_entitlements_user_id ON entitlements (user_id);
