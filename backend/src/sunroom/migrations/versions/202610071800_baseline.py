"""baseline: household, members, devices, codes, photos, plugins, display panels, network allowlist

Revision ID: 202610071800
Revises:
Create Date: 2026-10-07 18:00:00 UTC

Forward-only: never edit this file once it is listed in released.lock.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '202610071800'
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('app_meta',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('auth_epoch', sa.Integer(), nullable=False),
    sa.Column('password_hash', sa.String(length=200), nullable=True),
    sa.Column('password_fp', sa.String(length=64), nullable=True),
    sa.Column('secret_key_check', sa.String(length=64), nullable=True),
    sa.Column('last_boot_version', sa.String(length=32), nullable=True),
    sa.CheckConstraint('id = 1', name=op.f('ck_app_meta_single_row')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_app_meta'))
    )
    op.create_table('household',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=80), nullable=False),
    sa.Column('timezone', sa.String(length=64), nullable=True),
    sa.Column('week_starts_on', sa.Integer(), nullable=False),
    sa.Column('time_format', sa.String(length=4), nullable=False),
    sa.Column('theme', sa.String(length=8), nullable=False),
    sa.Column('daylight_tint', sa.Boolean(), nullable=False),
    sa.Column('text_size', sa.String(length=10), nullable=False),
    sa.Column('display_home_view', sa.String(length=10), nullable=False),
    sa.Column('display_return_minutes', sa.Integer(), nullable=False),
    sa.Column('display_rail_side', sa.String(length=8), nullable=False),
    sa.Column('display_controls_bottom', sa.Boolean(), nullable=False),
    sa.Column('display_show_today_panel', sa.Boolean(), nullable=False),
    sa.Column('display_orientation', sa.String(length=10), nullable=False),
    sa.Column('display_sounds', sa.Boolean(), nullable=False),
    sa.Column('display_dim_past', sa.Boolean(), nullable=False),
    sa.Column('display_reduce_motion', sa.Boolean(), nullable=False),
    sa.Column('sleep_from', sa.String(length=5), nullable=True),
    sa.Column('sleep_to', sa.String(length=5), nullable=True),
    sa.Column('sleep_mode', sa.String(length=12), nullable=False),
    sa.Column('kid_safe_editing', sa.Boolean(), nullable=False),
    sa.Column('parent_pin_hash', sa.String(length=160), nullable=True),
    sa.Column('pin_length', sa.Integer(), nullable=True),
    sa.Column('pin_updated_at', sa.DateTime(), nullable=True),
    sa.Column('onboarded_at', sa.DateTime(), nullable=True),
    sa.Column('location_label', sa.String(length=120), nullable=True),
    sa.Column('latitude', sa.Float(), nullable=True),
    sa.Column('longitude', sa.Float(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.CheckConstraint('id = 1', name=op.f('ck_household_single_row')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_household'))
    )
    op.create_table('kiosk_panels',
    sa.Column('panel_key', sa.String(length=64), nullable=False),
    sa.Column('position', sa.Integer(), nullable=False),
    sa.Column('visible', sa.Boolean(), nullable=False),
    sa.Column('size', sa.String(length=8), nullable=False),
    sa.PrimaryKeyConstraint('panel_key', name=op.f('pk_kiosk_panels'))
    )
    op.create_table('photos',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('kind', sa.String(length=8), nullable=False),
    sa.Column('source_key', sa.String(length=64), nullable=False),
    sa.Column('original_name', sa.String(length=255), nullable=True),
    sa.Column('taken_at', sa.DateTime(), nullable=True),
    sa.Column('width', sa.Integer(), nullable=False),
    sa.Column('height', sa.Integer(), nullable=False),
    sa.Column('bytes', sa.Integer(), nullable=False),
    sa.Column('sha256', sa.String(length=64), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('hidden', sa.Boolean(), nullable=False),
    sa.Column('deleted_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_photos')),
    sa.UniqueConstraint('kind', 'sha256', name='uq_photos_kind_sha256')
    )
    op.create_table('plugin_state',
    sa.Column('plugin_id', sa.String(length=32), nullable=False),
    sa.Column('enabled', sa.Boolean(), nullable=False),
    sa.Column('settings_json', sa.Text(), nullable=False),
    sa.Column('settings_version', sa.Integer(), nullable=False),
    sa.Column('plugin_version', sa.String(length=16), nullable=False),
    sa.Column('enabled_at', sa.DateTime(), nullable=True),
    sa.Column('disabled_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('plugin_id', name=op.f('pk_plugin_state'))
    )
    op.create_table('members',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('name', sa.String(length=40), nullable=False),
    sa.Column('role', sa.String(length=8), nullable=False),
    sa.Column('color', sa.String(length=8), nullable=False),
    sa.Column('avatar_photo_id', sa.String(length=36), nullable=True),
    sa.Column('birthday', sa.String(length=10), nullable=True),
    sa.Column('sort', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('archived_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['avatar_photo_id'], ['photos.id'], name=op.f('fk_members_avatar_photo_id_photos'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_members'))
    )
    op.create_table('devices',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('label', sa.String(length=80), nullable=False),
    sa.Column('kind', sa.String(length=8), nullable=False),
    sa.Column('member_id', sa.String(length=36), nullable=True),
    sa.Column('is_kid_device', sa.Boolean(), nullable=False),
    sa.Column('paired_via', sa.String(length=12), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('last_seen_at', sa.DateTime(), nullable=False),
    sa.Column('revoked_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['member_id'], ['members.id'], name=op.f('fk_devices_member_id_members'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_devices'))
    )
    op.create_table('network_allowlist',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('target', sa.String(length=255), nullable=False),
    sa.Column('label', sa.String(length=80), nullable=False),
    sa.Column('created_by_member_id', sa.String(length=36), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['created_by_member_id'], ['members.id'], name=op.f('fk_network_allowlist_created_by_member_id_members'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_network_allowlist'))
    )
    op.create_table('join_codes',
    sa.Column('code_hash', sa.String(length=64), nullable=False),
    sa.Column('kind', sa.String(length=8), nullable=False),
    sa.Column('created_by_device_id', sa.String(length=36), nullable=True),
    sa.Column('poll_token_hash', sa.String(length=64), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('expires_at', sa.DateTime(), nullable=False),
    sa.Column('used_at', sa.DateTime(), nullable=True),
    sa.Column('used_by_device_id', sa.String(length=36), nullable=True),
    sa.ForeignKeyConstraint(['created_by_device_id'], ['devices.id'], name=op.f('fk_join_codes_created_by_device_id_devices'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['used_by_device_id'], ['devices.id'], name=op.f('fk_join_codes_used_by_device_id_devices'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('code_hash', name=op.f('pk_join_codes'))
    )
    with op.batch_alter_table('join_codes', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_join_codes_created_by_device_id'), ['created_by_device_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_join_codes_expires_at'), ['expires_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_join_codes_poll_token_hash'), ['poll_token_hash'], unique=False)

    # The two single-row tables always exist. onboarded_at stays NULL until the setup wizard
    # runs (PLAN §12.1). The display's Today panel starts with the calendar's block.
    op.execute(
        "INSERT INTO household (id, name, week_starts_on, time_format, theme, daylight_tint, "
        "text_size, display_home_view, display_return_minutes, display_rail_side, "
        "display_controls_bottom, display_show_today_panel, display_orientation, display_sounds, "
        "display_dim_past, display_reduce_motion, sleep_mode, kid_safe_editing, updated_at) "
        "VALUES (1, 'Our home', 6, '12h', 'auto', 1, 'standard', 'week', 5, 'left', 0, 1, "
        "'auto', 0, 1, 0, 'dim_clock', 1, CURRENT_TIMESTAMP)"
    )
    op.execute("INSERT INTO app_meta (id, auth_epoch) VALUES (1, 1)")
    op.execute(
        "INSERT INTO kiosk_panels (panel_key, position, visible, size) "
        "VALUES ('calendar.today', 0, 1, 'm')"
    )


def downgrade() -> None:
    raise NotImplementedError("Migrations are forward-only; restore the pre-migration backup.")
