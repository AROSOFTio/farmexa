"""
Add store_locations, goods_issue_vouchers, and goods_received_notes tables for GRN/GIV workflows.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "019_grn_giv_stores"
down_revision = "018_user_permissions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enums explicitly (checkfirst avoids duplicate error)
    postgresql.ENUM(
        'main_store', 'feed_store', 'medicine_store', 'poultry_house',
        'slaughter_area', 'cold_room', 'sales_store', 'other',
        name='storelocationtype'
    ).create(op.get_bind(), checkfirst=True)

    postgresql.ENUM(
        'draft', 'approved', 'issued', 'cancelled',
        name='givstatus'
    ).create(op.get_bind(), checkfirst=True)

    postgresql.ENUM(
        'draft', 'approved', 'received', 'cancelled',
        name='grnstatus'
    ).create(op.get_bind(), checkfirst=True)

    # Use create_type=False so create_table does NOT try to CREATE TYPE again
    store_location_type_col = postgresql.ENUM(
        'main_store', 'feed_store', 'medicine_store', 'poultry_house',
        'slaughter_area', 'cold_room', 'sales_store', 'other',
        name='storelocationtype', create_type=False
    )
    giv_status_col = postgresql.ENUM(
        'draft', 'approved', 'issued', 'cancelled',
        name='givstatus', create_type=False
    )
    grn_status_col = postgresql.ENUM(
        'draft', 'approved', 'received', 'cancelled',
        name='grnstatus', create_type=False
    )

    # Create store_locations table
    op.create_table(
        "store_locations",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("type", store_location_type_col, nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default='true'),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name", name="uq_store_locations_name"),
        sa.UniqueConstraint("code", name="uq_store_locations_code"),
    )
    op.create_index("ix_store_locations_id", "store_locations", ["id"])
    op.create_index("ix_store_locations_name", "store_locations", ["name"])
    op.create_index("ix_store_locations_code", "store_locations", ["code"])

    # Create goods_issue_vouchers table
    op.create_table(
        "goods_issue_vouchers",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("giv_number", sa.String(), nullable=False),
        sa.Column("item_id", sa.BigInteger(), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(), nullable=False, server_default='kg'),
        sa.Column("from_store_location_id", sa.BigInteger(), nullable=False),
        sa.Column("destination", sa.String(), nullable=True),
        sa.Column("purpose", sa.String(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", giv_status_col, nullable=False, server_default='draft'),
        sa.Column("issued_by_id", sa.BigInteger(), nullable=False),
        sa.Column("approved_by_id", sa.BigInteger(), nullable=True),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(["item_id"], ["stock_items.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["from_store_location_id"], ["store_locations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["issued_by_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["approved_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("giv_number", name="uq_giv_number"),
    )
    op.create_index("ix_goods_issue_vouchers_id", "goods_issue_vouchers", ["id"])
    op.create_index("ix_goods_issue_vouchers_giv_number", "goods_issue_vouchers", ["giv_number"])

    # Create goods_received_notes table
    op.create_table(
        "goods_received_notes",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("grn_number", sa.String(), nullable=False),
        sa.Column("item_id", sa.BigInteger(), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(), nullable=False, server_default='kg'),
        sa.Column("received_into_store_location_id", sa.BigInteger(), nullable=False),
        sa.Column("source_type", sa.String(), nullable=False, server_default='supplier'),
        sa.Column("supplier_reference", sa.String(), nullable=True),
        sa.Column("unit_cost", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", grn_status_col, nullable=False, server_default='draft'),
        sa.Column("received_by_id", sa.BigInteger(), nullable=False),
        sa.Column("approved_by_id", sa.BigInteger(), nullable=True),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(["item_id"], ["stock_items.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["received_into_store_location_id"], ["store_locations.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["received_by_id"], ["users.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["approved_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("grn_number", name="uq_grn_number"),
    )
    op.create_index("ix_goods_received_notes_id", "goods_received_notes", ["id"])
    op.create_index("ix_goods_received_notes_grn_number", "goods_received_notes", ["grn_number"])


def downgrade() -> None:
    op.drop_index("ix_goods_received_notes_grn_number", table_name="goods_received_notes")
    op.drop_index("ix_goods_received_notes_id", table_name="goods_received_notes")
    op.drop_table("goods_received_notes")

    op.drop_index("ix_goods_issue_vouchers_giv_number", table_name="goods_issue_vouchers")
    op.drop_index("ix_goods_issue_vouchers_id", table_name="goods_issue_vouchers")
    op.drop_table("goods_issue_vouchers")

    op.drop_index("ix_store_locations_code", table_name="store_locations")
    op.drop_index("ix_store_locations_name", table_name="store_locations")
    op.drop_index("ix_store_locations_id", table_name="store_locations")
    op.drop_table("store_locations")

    postgresql.ENUM(name='grnstatus').drop(op.get_bind())
    postgresql.ENUM(name='givstatus').drop(op.get_bind())
    postgresql.ENUM(name='storelocationtype').drop(op.get_bind())
