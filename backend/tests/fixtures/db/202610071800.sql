BEGIN TRANSACTION;
CREATE TABLE alembic_version (
	version_num VARCHAR(32) NOT NULL, 
	CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);
INSERT INTO "alembic_version" VALUES('202610071800');
CREATE TABLE app_meta (
	id INTEGER NOT NULL, 
	auth_epoch INTEGER NOT NULL, 
	password_hash VARCHAR(200), 
	password_fp VARCHAR(64), 
	secret_key_check VARCHAR(64), 
	last_boot_version VARCHAR(32), 
	CONSTRAINT pk_app_meta PRIMARY KEY (id), 
	CONSTRAINT ck_app_meta_single_row CHECK (id = 1)
);
INSERT INTO "app_meta" VALUES(1,1,'scrypt$sample$sample',NULL,NULL,'0.1.0');
CREATE TABLE devices (
	id VARCHAR(36) NOT NULL, 
	label VARCHAR(80) NOT NULL, 
	kind VARCHAR(8) NOT NULL, 
	member_id VARCHAR(36), 
	is_kid_device BOOLEAN NOT NULL, 
	paired_via VARCHAR(12) NOT NULL, 
	created_at DATETIME NOT NULL, 
	last_seen_at DATETIME NOT NULL, 
	revoked_at DATETIME, 
	CONSTRAINT pk_devices PRIMARY KEY (id), 
	CONSTRAINT fk_devices_member_id_members FOREIGN KEY(member_id) REFERENCES members (id) ON DELETE SET NULL
);
INSERT INTO "devices" VALUES('00000000-0000-7000-8000-0000000000d1','iPhone, Safari','phone','00000000-0000-7000-8000-000000000001',0,'password','2026-10-07 12:00:00','2026-10-07 12:30:00',NULL);
INSERT INTO "devices" VALUES('00000000-0000-7000-8000-0000000000d2','Kitchen screen','kiosk',NULL,0,'kiosk_code','2026-10-07 12:10:00','2026-10-07 12:40:00',NULL);
CREATE TABLE household (
	id INTEGER NOT NULL, 
	name VARCHAR(80) NOT NULL, 
	timezone VARCHAR(64), 
	week_starts_on INTEGER NOT NULL, 
	time_format VARCHAR(4) NOT NULL, 
	theme VARCHAR(8) NOT NULL, 
	daylight_tint BOOLEAN NOT NULL, 
	text_size VARCHAR(10) NOT NULL, 
	display_home_view VARCHAR(10) NOT NULL, 
	display_return_minutes INTEGER NOT NULL, 
	display_rail_side VARCHAR(8) NOT NULL, 
	display_controls_bottom BOOLEAN NOT NULL, 
	display_show_today_panel BOOLEAN NOT NULL, 
	display_orientation VARCHAR(10) NOT NULL, 
	display_sounds BOOLEAN NOT NULL, 
	display_dim_past BOOLEAN NOT NULL, 
	display_reduce_motion BOOLEAN NOT NULL, 
	sleep_from VARCHAR(5), 
	sleep_to VARCHAR(5), 
	sleep_mode VARCHAR(12) NOT NULL, 
	kid_safe_editing BOOLEAN NOT NULL, 
	parent_pin_hash VARCHAR(160), 
	pin_length INTEGER, 
	pin_updated_at DATETIME, 
	onboarded_at DATETIME, 
	location_label VARCHAR(120), 
	latitude FLOAT, 
	longitude FLOAT, 
	updated_at DATETIME NOT NULL, 
	CONSTRAINT pk_household PRIMARY KEY (id), 
	CONSTRAINT ck_household_single_row CHECK (id = 1)
);
INSERT INTO "household" VALUES(1,'Sample Family','America/New_York',6,'12h','auto',1,'standard','week',5,'left',0,1,'auto',0,1,0,NULL,NULL,'dim_clock',1,NULL,NULL,NULL,'2026-10-07 12:00:00',NULL,NULL,NULL,'2026-10-07 12:00:00');
CREATE TABLE join_codes (
	code_hash VARCHAR(64) NOT NULL, 
	kind VARCHAR(8) NOT NULL, 
	created_by_device_id VARCHAR(36), 
	poll_token_hash VARCHAR(64), 
	created_at DATETIME NOT NULL, 
	expires_at DATETIME NOT NULL, 
	used_at DATETIME, 
	used_by_device_id VARCHAR(36), 
	CONSTRAINT pk_join_codes PRIMARY KEY (code_hash), 
	CONSTRAINT fk_join_codes_created_by_device_id_devices FOREIGN KEY(created_by_device_id) REFERENCES devices (id) ON DELETE CASCADE, 
	CONSTRAINT fk_join_codes_used_by_device_id_devices FOREIGN KEY(used_by_device_id) REFERENCES devices (id) ON DELETE SET NULL
);
INSERT INTO "join_codes" VALUES('0000000000000000000000000000000000000000000000000000000000000002','kiosk',NULL,'0000000000000000000000000000000000000000000000000000000000000003','2026-10-07 12:09:00','2026-10-07 12:19:00','2026-10-07 12:10:00','00000000-0000-7000-8000-0000000000d2');
CREATE TABLE kiosk_panels (
	panel_key VARCHAR(64) NOT NULL, 
	position INTEGER NOT NULL, 
	visible BOOLEAN NOT NULL, 
	size VARCHAR(8) NOT NULL, 
	CONSTRAINT pk_kiosk_panels PRIMARY KEY (panel_key)
);
INSERT INTO "kiosk_panels" VALUES('calendar.today',0,1,'m');
CREATE TABLE members (
	id VARCHAR(36) NOT NULL, 
	name VARCHAR(40) NOT NULL, 
	role VARCHAR(8) NOT NULL, 
	color VARCHAR(8) NOT NULL, 
	avatar_photo_id VARCHAR(36), 
	birthday VARCHAR(10), 
	sort INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	archived_at DATETIME, 
	CONSTRAINT pk_members PRIMARY KEY (id), 
	CONSTRAINT fk_members_avatar_photo_id_photos FOREIGN KEY(avatar_photo_id) REFERENCES photos (id) ON DELETE SET NULL
);
INSERT INTO "members" VALUES('00000000-0000-7000-8000-000000000001','Sample Parent','parent','sky','00000000-0000-7000-8000-000000000201',NULL,0,'2026-10-07 12:01:00',NULL);
INSERT INTO "members" VALUES('00000000-0000-7000-8000-000000000002','Sample Kid','kid','berry',NULL,'2018-05-04',1,'2026-10-07 12:02:00',NULL);
INSERT INTO "members" VALUES('00000000-0000-7000-8000-000000000003','Sample Guest','parent','moss',NULL,NULL,2,'2026-10-07 12:03:00','2026-10-07 13:00:00');
CREATE TABLE network_allowlist (
	id VARCHAR(36) NOT NULL, 
	target VARCHAR(255) NOT NULL, 
	label VARCHAR(80) NOT NULL, 
	created_by_member_id VARCHAR(36), 
	created_at DATETIME NOT NULL, 
	CONSTRAINT pk_network_allowlist PRIMARY KEY (id), 
	CONSTRAINT fk_network_allowlist_created_by_member_id_members FOREIGN KEY(created_by_member_id) REFERENCES members (id) ON DELETE SET NULL
);
INSERT INTO "network_allowlist" VALUES('00000000-0000-7000-8000-000000000301','192.168.1.20/32','Sample NAS','00000000-0000-7000-8000-000000000001','2026-10-07 12:20:00');
CREATE TABLE photos (
	id VARCHAR(36) NOT NULL, 
	kind VARCHAR(8) NOT NULL, 
	source_key VARCHAR(64) NOT NULL, 
	original_name VARCHAR(255), 
	taken_at DATETIME, 
	width INTEGER NOT NULL, 
	height INTEGER NOT NULL, 
	bytes INTEGER NOT NULL, 
	sha256 VARCHAR(64) NOT NULL, 
	created_at DATETIME NOT NULL, 
	hidden BOOLEAN NOT NULL, 
	deleted_at DATETIME, 
	CONSTRAINT pk_photos PRIMARY KEY (id), 
	CONSTRAINT uq_photos_kind_sha256 UNIQUE (kind, sha256)
);
INSERT INTO "photos" VALUES('00000000-0000-7000-8000-000000000201','avatar','upload','sample.jpg',NULL,512,512,2048,'0000000000000000000000000000000000000000000000000000000000000001','2026-10-07 12:05:00',0,NULL);
CREATE TABLE plugin_state (
	plugin_id VARCHAR(32) NOT NULL, 
	enabled BOOLEAN NOT NULL, 
	settings_json TEXT NOT NULL, 
	settings_version INTEGER NOT NULL, 
	plugin_version VARCHAR(16) NOT NULL, 
	enabled_at DATETIME, 
	disabled_at DATETIME, 
	updated_at DATETIME NOT NULL, 
	CONSTRAINT pk_plugin_state PRIMARY KEY (plugin_id)
);
INSERT INTO "plugin_state" VALUES('sample',0,'{}',1,'1.0.0',NULL,NULL,'2026-10-07 12:00:00');
CREATE INDEX ix_join_codes_created_by_device_id ON join_codes (created_by_device_id);
CREATE INDEX ix_join_codes_expires_at ON join_codes (expires_at);
CREATE INDEX ix_join_codes_poll_token_hash ON join_codes (poll_token_hash);
COMMIT;
