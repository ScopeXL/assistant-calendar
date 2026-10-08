BEGIN TRANSACTION;
CREATE TABLE alembic_version (
	version_num VARCHAR(32) NOT NULL, 
	CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);
INSERT INTO "alembic_version" VALUES('202610081650');
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
CREATE TABLE calendars (
	id VARCHAR(36) NOT NULL, 
	name VARCHAR(80) NOT NULL, 
	color VARCHAR(8) NOT NULL, 
	kind VARCHAR(8) NOT NULL, 
	owner_member_id VARCHAR(36), 
	read_only BOOLEAN NOT NULL, 
	visible_on_display BOOLEAN NOT NULL, 
	version INTEGER NOT NULL, 
	remote_ref VARCHAR(500), 
	sort INTEGER NOT NULL, 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	deleted_at DATETIME, 
	CONSTRAINT pk_calendars PRIMARY KEY (id), 
	CONSTRAINT fk_calendars_owner_member_id_members FOREIGN KEY(owner_member_id) REFERENCES members (id)
);
INSERT INTO "calendars" VALUES('01a11cf3-443c-7645-8ffe-8f60d9e3b1c4','Home','sky','local',NULL,0,1,1,NULL,0,'2026-10-08 19:17:47.196481','2026-10-08 19:17:47.196481',NULL);
INSERT INTO "calendars" VALUES('00000000-0000-7000-8000-000000000401','Kids'' activities','iris','local','00000000-0000-7000-8000-000000000002',0,1,3,NULL,1,'2026-10-08 12:00:00','2026-10-08 12:00:00',NULL);
INSERT INTO "calendars" VALUES('00000000-0000-7000-8000-000000000402','School','olive','sync','00000000-0000-7000-8000-000000000002',1,1,1,'a calendar address',1000,'2026-10-08 18:00:00','2026-10-08 18:00:00',NULL);
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
CREATE TABLE event_members (
	event_id VARCHAR(36) NOT NULL, 
	member_id VARCHAR(36) NOT NULL, 
	CONSTRAINT pk_event_members PRIMARY KEY (event_id, member_id), 
	CONSTRAINT fk_event_members_event_id_events FOREIGN KEY(event_id) REFERENCES events (id) ON DELETE CASCADE, 
	CONSTRAINT fk_event_members_member_id_members FOREIGN KEY(member_id) REFERENCES members (id)
);
INSERT INTO "event_members" VALUES('00000000-0000-7000-8000-000000000501','00000000-0000-7000-8000-000000000002');
INSERT INTO "event_members" VALUES('00000000-0000-7000-8000-000000000502','00000000-0000-7000-8000-000000000002');
INSERT INTO "event_members" VALUES('00000000-0000-7000-8000-000000000504','00000000-0000-7000-8000-000000000001');
CREATE TABLE event_reminders (
	event_id VARCHAR(36) NOT NULL, 
	minutes_before INTEGER NOT NULL, 
	CONSTRAINT pk_event_reminders PRIMARY KEY (event_id, minutes_before), 
	CONSTRAINT fk_event_reminders_event_id_events FOREIGN KEY(event_id) REFERENCES events (id) ON DELETE CASCADE
);
INSERT INTO "event_reminders" VALUES('00000000-0000-7000-8000-000000000501',30);
CREATE TABLE event_revisions (
	id VARCHAR(36) NOT NULL, 
	series_id VARCHAR(36) NOT NULL, 
	action VARCHAR(10) NOT NULL, 
	before_json TEXT NOT NULL, 
	created_ids_json TEXT NOT NULL, 
	device_id VARCHAR(36), 
	member_id VARCHAR(36), 
	created_at DATETIME NOT NULL, 
	undone_at DATETIME, 
	CONSTRAINT pk_event_revisions PRIMARY KEY (id)
);
INSERT INTO "event_revisions" VALUES('00000000-0000-7000-8000-000000000601','00000000-0000-7000-8000-000000000504','delete','[]','[]','00000000-0000-7000-8000-0000000000d1','00000000-0000-7000-8000-000000000001','2026-10-08 12:04:00',NULL);
CREATE TABLE events (
	id VARCHAR(36) NOT NULL, 
	calendar_id VARCHAR(36) NOT NULL, 
	parent_event_id VARCHAR(36), 
	recurrence_id VARCHAR(19), 
	title VARCHAR(200) NOT NULL, 
	description TEXT NOT NULL, 
	location VARCHAR(300) NOT NULL, 
	all_day BOOLEAN NOT NULL, 
	start_utc DATETIME, 
	end_utc DATETIME, 
	tzid VARCHAR(64), 
	start_date VARCHAR(10), 
	end_date VARCHAR(10), 
	floating BOOLEAN NOT NULL, 
	rrule VARCHAR(500), 
	rdates_json TEXT NOT NULL, 
	exdates_json TEXT NOT NULL, 
	window_start_utc DATETIME NOT NULL, 
	window_end_utc DATETIME NOT NULL, 
	status VARCHAR(10) NOT NULL, 
	color VARCHAR(8), 
	source VARCHAR(8) NOT NULL, 
	remote_uid VARCHAR(500), 
	remote_id VARCHAR(500), 
	etag VARCHAR(200), 
	remote_updated_at DATETIME, 
	remote_sequence INTEGER, 
	pending_push BOOLEAN NOT NULL, 
	pending_delete BOOLEAN NOT NULL, 
	raw_ical TEXT, 
	version INTEGER NOT NULL, 
	created_by_member_id VARCHAR(36), 
	created_at DATETIME NOT NULL, 
	updated_at DATETIME NOT NULL, 
	deleted_at DATETIME, 
	CONSTRAINT pk_events PRIMARY KEY (id), 
	CONSTRAINT ck_events_one_timing CHECK ((all_day = 0 AND start_utc IS NOT NULL AND end_utc IS NOT NULL AND tzid IS NOT NULL AND start_date IS NULL AND end_date IS NULL) OR (all_day = 1 AND start_date IS NOT NULL AND end_date IS NOT NULL AND start_utc IS NULL AND end_utc IS NULL)), 
	CONSTRAINT ck_events_override_has_parent CHECK (recurrence_id IS NULL OR parent_event_id IS NOT NULL), 
	CONSTRAINT fk_events_calendar_id_calendars FOREIGN KEY(calendar_id) REFERENCES calendars (id), 
	CONSTRAINT fk_events_created_by_member_id_members FOREIGN KEY(created_by_member_id) REFERENCES members (id), 
	CONSTRAINT fk_events_parent_event_id_events FOREIGN KEY(parent_event_id) REFERENCES events (id), 
	CONSTRAINT uq_events_calendar_id UNIQUE (calendar_id, remote_uid, recurrence_id)
);
INSERT INTO "events" VALUES('00000000-0000-7000-8000-000000000501','00000000-0000-7000-8000-000000000401',NULL,NULL,'Soccer practice','','Field 3',0,'2026-09-29 20:00:00','2026-09-29 21:00:00','America/New_York',NULL,NULL,0,'FREQ=WEEKLY;BYDAY=TU,TH','[]','["2026-10-13T16:00:00"]','2026-09-29 20:00:00','9999-12-31 00:00:00','confirmed',NULL,'local',NULL,NULL,NULL,NULL,NULL,0,0,NULL,2,'00000000-0000-7000-8000-000000000001','2026-10-08 12:01:00','2026-10-08 12:05:00',NULL);
INSERT INTO "events" VALUES('00000000-0000-7000-8000-000000000502','00000000-0000-7000-8000-000000000401','00000000-0000-7000-8000-000000000501','2026-10-08T16:00:00','Soccer practice','','Field 3',0,'2026-10-08 21:00:00','2026-10-08 22:00:00','America/New_York',NULL,NULL,0,NULL,'[]','[]','2026-10-08 21:00:00','2026-10-08 22:00:00','confirmed',NULL,'local',NULL,NULL,NULL,NULL,NULL,0,0,NULL,1,'00000000-0000-7000-8000-000000000001','2026-10-08 12:05:00','2026-10-08 12:05:00',NULL);
INSERT INTO "events" VALUES('00000000-0000-7000-8000-000000000503','00000000-0000-7000-8000-000000000401',NULL,NULL,'Pajama day','','',1,NULL,NULL,NULL,'2026-10-09','2026-10-10',0,NULL,'[]','[]','2026-10-09 00:00:00','2026-10-11 00:00:00','confirmed','rose','local',NULL,NULL,NULL,NULL,NULL,0,0,NULL,1,'00000000-0000-7000-8000-000000000001','2026-10-08 12:02:00','2026-10-08 12:02:00',NULL);
INSERT INTO "events" VALUES('00000000-0000-7000-8000-000000000504','00000000-0000-7000-8000-000000000401',NULL,NULL,'Vet','','',0,'2026-10-07 13:00:00','2026-10-07 13:30:00','America/New_York',NULL,NULL,0,NULL,'[]','[]','2026-10-07 13:00:00','2026-10-07 13:30:00','confirmed',NULL,'local',NULL,NULL,NULL,NULL,NULL,0,0,NULL,2,'00000000-0000-7000-8000-000000000001','2026-10-08 12:03:00','2026-10-08 12:04:00','2026-10-08 12:04:00');
INSERT INTO "events" VALUES('00000000-0000-7000-8000-000000000505','00000000-0000-7000-8000-000000000402',NULL,NULL,'Field trip','','Sample Farm',0,'2026-10-15 13:00:00','2026-10-15 17:00:00','America/New_York',NULL,NULL,0,NULL,'[]','[]','2026-10-15 13:00:00','2026-10-15 17:00:00','confirmed',NULL,'sync','field-trip@school.example.com',NULL,NULL,'2026-10-08 17:00:00',0,0,0,NULL,1,NULL,'2026-10-08 18:00:00','2026-10-08 18:00:00',NULL);
CREATE TABLE "household" (
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
	default_calendar_id VARCHAR(36), 
	CONSTRAINT pk_household PRIMARY KEY (id), 
	CONSTRAINT ck_household_single_row CHECK (id = 1), 
	CONSTRAINT fk_household_default_calendar_id_calendars FOREIGN KEY(default_calendar_id) REFERENCES calendars (id)
);
INSERT INTO "household" VALUES(1,'Sample Family','America/New_York',6,'12h','auto',1,'standard','week',5,'left',0,1,'auto',0,1,0,NULL,NULL,'dim_clock',1,NULL,NULL,NULL,'2026-10-07 12:00:00',NULL,NULL,NULL,'2026-10-07 12:00:00','01a11cf3-443c-7645-8ffe-8f60d9e3b1c4');
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
CREATE TABLE oauth_states (
	state_hash VARCHAR(64) NOT NULL, 
	provider VARCHAR(16) NOT NULL, 
	code_verifier VARCHAR(128) NOT NULL, 
	device_id VARCHAR(36), 
	account_id VARCHAR(36), 
	created_at DATETIME NOT NULL, 
	expires_at DATETIME NOT NULL, 
	used_at DATETIME, 
	CONSTRAINT pk_oauth_states PRIMARY KEY (state_hash)
);
INSERT INTO "oauth_states" VALUES('0000000000000000000000000000000000000000000000000000000000000004','google','sample-verifier','00000000-0000-7000-8000-0000000000d1',NULL,'2026-10-08 18:40:00','2026-10-08 18:50:00',NULL);
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
INSERT INTO "plugin_state" VALUES('calendar_sync',1,'{"google_client_id": null, "google_client_secret": null}',1,'1.0.0','2026-10-08 18:00:00',NULL,'2026-10-08 18:00:00');
CREATE TABLE remote_calendars (
	id VARCHAR(36) NOT NULL, 
	account_id VARCHAR(36) NOT NULL, 
	remote_id VARCHAR(500) NOT NULL, 
	name VARCHAR(200) NOT NULL, 
	color_hint VARCHAR(9), 
	read_only BOOLEAN NOT NULL, 
	mapped BOOLEAN NOT NULL, 
	calendar_id VARCHAR(36), 
	sync_token TEXT, 
	ctag VARCHAR(200), 
	last_synced_at DATETIME, 
	last_error VARCHAR(300), 
	created_at DATETIME NOT NULL, 
	CONSTRAINT pk_remote_calendars PRIMARY KEY (id), 
	CONSTRAINT fk_remote_calendars_account_id_sync_accounts FOREIGN KEY(account_id) REFERENCES sync_accounts (id), 
	CONSTRAINT fk_remote_calendars_calendar_id_calendars FOREIGN KEY(calendar_id) REFERENCES calendars (id), 
	CONSTRAINT uq_remote_calendars_account_id UNIQUE (account_id, remote_id)
);
INSERT INTO "remote_calendars" VALUES('00000000-0000-7000-8000-000000000702','00000000-0000-7000-8000-000000000701','feed-000000000000000000000001','School',NULL,1,1,'00000000-0000-7000-8000-000000000402','{"etag": "\"1\""}',NULL,'2026-10-08 18:30:00',NULL,'2026-10-08 18:00:00');
CREATE TABLE sync_accounts (
	id VARCHAR(36) NOT NULL, 
	provider VARCHAR(16) NOT NULL, 
	auth_mode VARCHAR(16) NOT NULL, 
	label VARCHAR(120) NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	server_url VARCHAR(500), 
	username VARCHAR(200), 
	credentials_enc TEXT, 
	config_json TEXT NOT NULL, 
	allow_private BOOLEAN NOT NULL, 
	owner_member_id VARCHAR(36), 
	interval_s INTEGER NOT NULL, 
	last_sync_at DATETIME, 
	last_success_at DATETIME, 
	next_sync_at DATETIME, 
	last_error VARCHAR(300), 
	last_error_at DATETIME, 
	consecutive_failures INTEGER NOT NULL, 
	version INTEGER NOT NULL, 
	created_by_member_id VARCHAR(36), 
	created_at DATETIME NOT NULL, 
	deleted_at DATETIME, 
	CONSTRAINT pk_sync_accounts PRIMARY KEY (id), 
	CONSTRAINT fk_sync_accounts_created_by_member_id_members FOREIGN KEY(created_by_member_id) REFERENCES members (id), 
	CONSTRAINT fk_sync_accounts_owner_member_id_members FOREIGN KEY(owner_member_id) REFERENCES members (id)
);
INSERT INTO "sync_accounts" VALUES('00000000-0000-7000-8000-000000000701','ics','none','School','connected','school.example.com/school.ics',NULL,'sample-ciphertext','{}',0,'00000000-0000-7000-8000-000000000002',1800,'2026-10-08 18:30:00','2026-10-08 18:30:00','2026-10-08 19:00:00',NULL,NULL,0,1,'00000000-0000-7000-8000-000000000001','2026-10-08 18:00:00',NULL);
CREATE TABLE sync_runs (
	id VARCHAR(36) NOT NULL, 
	account_id VARCHAR(36) NOT NULL, 
	started_at DATETIME NOT NULL, 
	finished_at DATETIME, 
	outcome VARCHAR(16) NOT NULL, 
	fetched INTEGER NOT NULL, 
	created INTEGER NOT NULL, 
	updated INTEGER NOT NULL, 
	deleted INTEGER NOT NULL, 
	pushed INTEGER NOT NULL, 
	error VARCHAR(300), 
	duration_ms INTEGER, 
	CONSTRAINT pk_sync_runs PRIMARY KEY (id), 
	CONSTRAINT fk_sync_runs_account_id_sync_accounts FOREIGN KEY(account_id) REFERENCES sync_accounts (id)
);
INSERT INTO "sync_runs" VALUES('00000000-0000-7000-8000-000000000801','00000000-0000-7000-8000-000000000701','2026-10-08 18:30:00','2026-10-08 18:30:01','ok',1,0,0,0,0,NULL,140);
CREATE INDEX ix_join_codes_created_by_device_id ON join_codes (created_by_device_id);
CREATE INDEX ix_join_codes_expires_at ON join_codes (expires_at);
CREATE INDEX ix_join_codes_poll_token_hash ON join_codes (poll_token_hash);
CREATE INDEX ix_event_revisions_created_at ON event_revisions (created_at);
CREATE INDEX ix_event_revisions_series_id ON event_revisions (series_id);
CREATE INDEX ix_events_parent_event_id ON events (parent_event_id);
CREATE INDEX ix_events_range ON events (calendar_id, window_start_utc, window_end_utc);
CREATE INDEX ix_remote_calendars_account_id ON remote_calendars (account_id);
CREATE INDEX ix_sync_runs_account_id ON sync_runs (account_id);
COMMIT;
