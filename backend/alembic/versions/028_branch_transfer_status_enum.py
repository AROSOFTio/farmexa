"""
Give branch_transfers.status its own enum type.

The table was created against the pre-existing 'transferstatus' type, which
belongs to stock_transfers and has values (draft/issued/received/cancelled).
BranchTransfer expects (pending/in_transit/completed/rejected/cancelled), so
every insert failed. Create 'branchtransferstatus' and convert the column,
mapping any legacy values across.
"""

from alembic import op


revision = "028_branch_transfer_status"
down_revision = "027_slaughter_chick_cost"
branch_labels = None
depends_on = None

_CONVERT_SQL = """
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'branchtransferstatus') THEN
        CREATE TYPE branchtransferstatus AS ENUM ('pending', 'in_transit', 'completed', 'rejected', 'cancelled');
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'branch_transfers' AND column_name = 'status' AND udt_name = 'transferstatus'
    ) THEN
        ALTER TABLE branch_transfers ALTER COLUMN status DROP DEFAULT;
        ALTER TABLE branch_transfers
            ALTER COLUMN status TYPE branchtransferstatus
            USING (CASE status::text
                WHEN 'draft' THEN 'pending'
                WHEN 'issued' THEN 'in_transit'
                WHEN 'received' THEN 'completed'
                ELSE 'cancelled'
            END)::branchtransferstatus;
    END IF;
END $$;
"""


def upgrade() -> None:
    op.execute(_CONVERT_SQL)


def downgrade() -> None:
    op.execute(
        """
        ALTER TABLE branch_transfers
            ALTER COLUMN status TYPE transferstatus
            USING (CASE status::text
                WHEN 'pending' THEN 'draft'
                WHEN 'in_transit' THEN 'issued'
                WHEN 'completed' THEN 'received'
                ELSE 'cancelled'
            END)::transferstatus;
        DROP TYPE IF EXISTS branchtransferstatus;
        """
    )
