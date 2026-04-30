"""
Add plan pricing, tenant module override state, house sections, and expanded reference types.
"""

from alembic import op
import sqlalchemy as sa


revision = "010_plan_pricing_house_sections"
down_revision = "009_staff_roles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM information_schema.columns
                WHERE table_name = 'tenants'
                  AND column_name = 'plan'
                  AND udt_name = 'subscriptionplan'
            ) THEN
                ALTER TABLE tenants ALTER COLUMN plan TYPE VARCHAR(50) USING plan::text;
            END IF;
        END $$;
        """
    )
    op.execute("DROP TYPE IF EXISTS subscriptionplan")

    op.add_column("plans", sa.Column("monthly_price", sa.Numeric(12, 2), nullable=False, server_default="0"))
    op.add_column("plans", sa.Column("quarterly_price", sa.Numeric(12, 2), nullable=False, server_default="0"))
    op.add_column("plans", sa.Column("annual_price", sa.Numeric(12, 2), nullable=False, server_default="0"))
    op.add_column("plans", sa.Column("currency", sa.String(length=10), nullable=False, server_default="UGX"))
    op.add_column("plans", sa.Column("trial_days", sa.Integer(), nullable=False, server_default="0"))

    op.execute(
        """
        UPDATE plans
        SET
            monthly_price = CASE code
                WHEN 'basic' THEN 250000
                WHEN 'standard' THEN 450000
                WHEN 'premium' THEN 750000
                ELSE 0
            END,
            quarterly_price = CASE code
                WHEN 'basic' THEN 720000
                WHEN 'standard' THEN 1290000
                WHEN 'premium' THEN 2160000
                ELSE 0
            END,
            annual_price = CASE code
                WHEN 'basic' THEN 2700000
                WHEN 'standard' THEN 4860000
                WHEN 'premium' THEN 8100000
                ELSE 0
            END,
            currency = 'UGX',
            trial_days = CASE
                WHEN code = 'custom' THEN 0
                ELSE 14
            END
        """
    )

    op.add_column("tenant_modules", sa.Column("is_manual_override", sa.Boolean(), nullable=False, server_default="false"))

    op.create_table(
        "poultry_house_sections",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("house_id", sa.Integer(), sa.ForeignKey("poultry_houses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("section_type", sa.String(length=80), nullable=False),
        sa.Column("capacity", sa.Integer(), nullable=False),
        sa.Column("status", sa.Enum("active", "maintenance", "inactive", name="housestatus", create_type=False), nullable=False, server_default="active"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.UniqueConstraint("house_id", "name", name="uq_house_section_name"),
    )
    op.create_index("ix_poultry_house_sections_house_id", "poultry_house_sections", ["house_id"])

    op.add_column("batches", sa.Column("section_id", sa.Integer(), nullable=True))
    op.create_index("ix_batches_section_id", "batches", ["section_id"])
    op.create_foreign_key(
        "fk_batches_section_id",
        "batches",
        "poultry_house_sections",
        ["section_id"],
        ["id"],
        ondelete="SET NULL",
    )

    for value in (
        "bird_type",
        "house_section_type",
        "feed_type",
        "medicine_type",
        "egg_grade",
        "slaughter_part",
        "byproduct_type",
        "expense_category",
        "payment_method",
        "unit_of_measure",
        "customer_type",
    ):
        op.execute(f"ALTER TYPE referencedatatype ADD VALUE IF NOT EXISTS '{value}'")


def downgrade() -> None:
    op.drop_constraint("fk_batches_section_id", "batches", type_="foreignkey")
    op.drop_index("ix_batches_section_id", table_name="batches")
    op.drop_column("batches", "section_id")

    op.drop_index("ix_poultry_house_sections_house_id", table_name="poultry_house_sections")
    op.drop_table("poultry_house_sections")

    op.drop_column("tenant_modules", "is_manual_override")

    op.drop_column("plans", "trial_days")
    op.drop_column("plans", "currency")
    op.drop_column("plans", "annual_price")
    op.drop_column("plans", "quarterly_price")
    op.drop_column("plans", "monthly_price")
