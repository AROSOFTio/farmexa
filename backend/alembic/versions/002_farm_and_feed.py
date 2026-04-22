"""Farm and feed schema: poultry_houses, batches, mortality, vaccinations, growth, suppliers, feed items, purchases, consumptions

Revision ID: 002_farm_and_feed
Revises: 001_initial_schema
Create Date: 2026-04-22 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "002_farm_and_feed"
down_revision = "001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Farm Models ──────────────────────────────────────────────────
    
    op.create_table(
        "poultry_houses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.Column("status", sa.Enum("active", "maintenance", "inactive", name="housestatus"), nullable=False, server_default="active"),
    )
    op.create_index(op.f("ix_poultry_houses_name"), "poultry_houses", ["name"], unique=True)

    op.create_table(
        "batches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("batch_number", sa.String(length=50), nullable=False),
        sa.Column("house_id", sa.Integer(), sa.ForeignKey("poultry_houses.id"), nullable=False),
        sa.Column("breed", sa.String(length=100), nullable=False),
        sa.Column("source", sa.String(length=200), nullable=True),
        sa.Column("arrival_date", sa.Date(), nullable=False),
        sa.Column("initial_quantity", sa.Integer(), nullable=False),
        sa.Column("active_quantity", sa.Integer(), nullable=False),
        sa.Column("status", sa.Enum("active", "depleted", "slaughtered", "sold", name="batchstatus"), nullable=False, server_default="active"),
    )
    op.create_index(op.f("ix_batches_batch_number"), "batches", ["batch_number"], unique=True)

    op.create_table(
        "mortality_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("batch_id", sa.Integer(), sa.ForeignKey("batches.id"), nullable=False),
        sa.Column("record_date", sa.Date(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("cause", sa.String(length=200), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
    )

    op.create_table(
        "vaccination_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("batch_id", sa.Integer(), sa.ForeignKey("batches.id"), nullable=False),
        sa.Column("vaccine_name", sa.String(length=150), nullable=False),
        sa.Column("scheduled_date", sa.Date(), nullable=False),
        sa.Column("administered_date", sa.Date(), nullable=True),
        sa.Column("status", sa.Enum("pending", "completed", "cancelled", name="vaccinationstatus"), nullable=False, server_default="pending"),
        sa.Column("notes", sa.Text(), nullable=True),
    )

    op.create_table(
        "growth_logs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("batch_id", sa.Integer(), sa.ForeignKey("batches.id"), nullable=False),
        sa.Column("record_date", sa.Date(), nullable=False),
        sa.Column("avg_weight_grams", sa.Float(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
    )

    # ── Feed Models ──────────────────────────────────────────────────

    op.create_table(
        "suppliers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("contact_person", sa.String(length=100), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("email", sa.String(length=100), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
    )
    op.create_index(op.f("ix_suppliers_name"), "suppliers", ["name"])

    op.create_table(
        "feed_categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
    )
    op.create_index(op.f("ix_feed_categories_name"), "feed_categories", ["name"], unique=True)

    op.create_table(
        "feed_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=150), nullable=False),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("feed_categories.id"), nullable=False),
        sa.Column("unit", sa.String(length=50), nullable=False, server_default="kg"),
        sa.Column("current_stock", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("reorder_threshold", sa.Float(), nullable=False, server_default="0.0"),
    )
    op.create_index(op.f("ix_feed_items_name"), "feed_items", ["name"])

    op.create_table(
        "feed_purchases",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("supplier_id", sa.Integer(), sa.ForeignKey("suppliers.id"), nullable=False),
        sa.Column("purchase_date", sa.Date(), nullable=False),
        sa.Column("invoice_number", sa.String(length=100), nullable=True),
        sa.Column("total_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
    )

    op.create_table(
        "feed_purchase_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("purchase_id", sa.Integer(), sa.ForeignKey("feed_purchases.id"), nullable=False),
        sa.Column("feed_item_id", sa.Integer(), sa.ForeignKey("feed_items.id"), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("unit_price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("total_price", sa.Numeric(precision=12, scale=2), nullable=False),
    )

    op.create_table(
        "feed_consumptions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("batch_id", sa.Integer(), sa.ForeignKey("batches.id"), nullable=False),
        sa.Column("feed_item_id", sa.Integer(), sa.ForeignKey("feed_items.id"), nullable=False),
        sa.Column("record_date", sa.Date(), nullable=False),
        sa.Column("quantity", sa.Float(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("feed_consumptions")
    op.drop_table("feed_purchase_items")
    op.drop_table("feed_purchases")
    op.drop_table("feed_items")
    op.drop_table("feed_categories")
    op.drop_table("suppliers")
    
    op.drop_table("growth_logs")
    op.drop_table("vaccination_logs")
    op.drop_table("mortality_logs")
    op.drop_table("batches")
    op.drop_table("poultry_houses")
    
    # Drop enums
    sa.Enum(name="housestatus").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="batchstatus").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="vaccinationstatus").drop(op.get_bind(), checkfirst=True)
