"""Phase 0: category account mappings, AR indexes, customer_balances view.

Revision ID: 025
Revises: 024
Create Date: 2026-06-12 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "025"
down_revision = "024"
branch_labels = None
depends_on = None


def _has_table(bind, table_name: str) -> bool:
    return table_name in sa.inspect(bind).get_table_names()


def upgrade() -> None:
    bind = op.get_bind()

    if _has_table(bind, "expense_categories"):
        op.add_column(
            "expense_categories",
            sa.Column("default_account_code", sa.String(length=20), nullable=True),
        )
    if _has_table(bind, "income_categories"):
        op.add_column(
            "income_categories",
            sa.Column("default_account_code", sa.String(length=20), nullable=True),
        )

    if _has_table(bind, "invoices"):
        op.create_index(
            "idx_invoices_customer_status",
            "invoices",
            ["customer_id", "status", "created_at"],
            unique=False,
            if_not_exists=True,
        )
    if _has_table(bind, "payments"):
        op.create_index(
            "idx_payments_invoice",
            "payments",
            ["invoice_id"],
            unique=False,
            if_not_exists=True,
        )

    if _has_table(bind, "customers") and _has_table(bind, "invoices"):
        op.execute(
            """
            CREATE OR REPLACE VIEW customer_balances AS
            SELECT
                c.id AS customer_id,
                COALESCE(
                    SUM(
                        CASE
                            WHEN i.status::text <> 'cancelled'
                            THEN i.total_amount - i.paid_amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS balance
            FROM customers c
            LEFT JOIN invoices i ON i.customer_id = c.id
            GROUP BY c.id
            """
        )


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS customer_balances")
    op.drop_index("idx_payments_invoice", table_name="payments")
    op.drop_index("idx_invoices_customer_status", table_name="invoices")
    op.drop_column("income_categories", "default_account_code")
    op.drop_column("expense_categories", "default_account_code")
