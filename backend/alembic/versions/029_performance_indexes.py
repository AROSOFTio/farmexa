"""Add performance indexes for reporting queries.

Revision ID: 029_performance_indexes
Revises: 028_branch_transfer_status
Create Date: 2026-06-13
"""
from alembic import op
import sqlalchemy as sa


revision = "029_performance_indexes"
down_revision = "028_branch_transfer_status"
branch_labels = None
depends_on = None

def _idx_exists(conn, index_name: str) -> bool:
    result = conn.execute(
        sa.text("SELECT 1 FROM pg_indexes WHERE indexname = :name"),
        {"name": index_name},
    )
    return result.fetchone() is not None


def upgrade() -> None:
    conn = op.get_bind()

    indexes = [
        # Journal lines — core of all accounting queries
        ("idx_journal_lines_account",        "journal_lines",    ["account_id"]),
        ("idx_journal_lines_branch",         "journal_lines",    ["branch_id"]),
        ("idx_journal_lines_batch",          "journal_lines",    ["batch_id"]),
        ("idx_journal_entries_date_tenant",  "journal_entries",  ["entry_date", "tenant_id"]),
        ("idx_journal_entries_status",       "journal_entries",  ["status"]),
        ("idx_journal_entries_ref",          "journal_entries",  ["reference_type", "reference_id"]),

        # Sales — AR aging, invoice lookups
        ("idx_invoices_customer_status",     "invoices",         ["customer_id", "status"]),
        ("idx_invoices_due_date",            "invoices",         ["due_date"]),
        ("idx_invoices_created_at",          "invoices",         ["created_at"]),
        ("idx_payments_invoice",             "payments",         ["invoice_id"]),
        ("idx_payments_created_at",          "payments",         ["created_at"]),

        # Inventory — stock reports
        ("idx_stock_movements_item_date",    "stock_movements",  ["item_id", "created_at"]),
        ("idx_stock_movements_branch",       "stock_movements",  ["branch_id"]),
        ("idx_stock_items_branch",           "stock_items",      ["branch_id", "is_active"]),

        # Farm — batch and mortality queries
        ("idx_batches_branch_status",        "batches",          ["branch_id", "status"]),
        ("idx_batches_tenant",               "batches",          ["tenant_id"]),
        ("idx_batches_house",                "batches",          ["house_id"]),
        ("idx_mortality_logs_batch_date",    "mortality_logs",   ["batch_id", "record_date"]),

        # Feed — cost analysis
        ("idx_feed_consumption_batch",       "feed_consumptions",["batch_id"]),
        ("idx_feed_consumption_date",        "feed_consumptions",["record_date"]),

        # Slaughter — yield and cost reports
        ("idx_slaughter_records_batch",      "slaughter_records",["batch_id"]),
        ("idx_slaughter_records_date",       "slaughter_records",["slaughter_date"]),

        # Compliance — expiry alerts
        ("idx_compliance_docs_expiry",       "compliance_documents", ["tenant_id", "expiry_date"]),
        ("idx_compliance_docs_status",       "compliance_documents", ["status"]),

        # Accounts — code lookups
        ("idx_accounts_code_tenant",         "accounts",         ["account_code", "tenant_id"]),
    ]

    for idx_name, table, columns in indexes:
        if not _idx_exists(conn, idx_name):
            try:
                op.create_index(idx_name, table, columns)
                print(f"  Created index: {idx_name}")
            except Exception as e:
                print(f"  Skipped {idx_name}: {e}")


def downgrade() -> None:
    indexes = [
        "idx_journal_lines_account", "idx_journal_lines_branch", "idx_journal_lines_batch",
        "idx_journal_entries_date_tenant", "idx_journal_entries_status", "idx_journal_entries_ref",
        "idx_invoices_customer_status", "idx_invoices_due_date", "idx_invoices_created_at",
        "idx_payments_invoice", "idx_payments_created_at",
        "idx_stock_movements_item_date", "idx_stock_movements_branch", "idx_stock_items_branch",
        "idx_batches_branch_status", "idx_batches_tenant", "idx_batches_house",
        "idx_mortality_logs_batch_date",
        "idx_feed_consumption_batch", "idx_feed_consumption_date",
        "idx_slaughter_records_batch", "idx_slaughter_records_date",
        "idx_compliance_docs_expiry", "idx_compliance_docs_status",
        "idx_accounts_code_tenant",
    ]
    for idx_name in indexes:
        try:
            op.drop_index(idx_name)
        except Exception:
            pass
