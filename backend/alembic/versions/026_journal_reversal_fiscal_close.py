"""add_journal_reversal_fiscal_close_slaughter_costs

Revision ID: 026
Revises: 7a6ece0657b6
Create Date: 2026-06-12

Adds:
- journal_entries.is_reversed (Boolean, default False)
- journal_entries.reversal_of_id (Integer FK to journal_entries.id, nullable)
- fiscal_years.closed_at (DateTime with timezone, nullable)
- slaughter_records.direct_labour_cost, overhead_cost, total_production_cost, cost_per_kg (Numeric 18,4)
- slaughter_records.production_journal_id (Integer, nullable)
- batches.chick_cost (Numeric 18,4, default 0)
- batches.tenant_id (Integer FK to tenants.id, nullable)
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '026'
down_revision = '025'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()

    # ── egg_production_logs ───────────────────────────────────────────
    op.add_column(
        'egg_production_logs',
        sa.Column('price_per_tray', sa.Numeric(precision=18, scale=4), nullable=True),
    )

    # ── journal_entries ───────────────────────────────────────────────
    op.add_column(
        'journal_entries',
        sa.Column('is_reversed', sa.Boolean(), nullable=False, server_default='false'),
    )
    op.add_column(
        'journal_entries',
        sa.Column('reversal_of_id', sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        'fk_journal_entries_reversal_of',
        'journal_entries', 'journal_entries',
        ['reversal_of_id'], ['id'],
        ondelete='SET NULL',
    )

    # ── fiscal_years ──────────────────────────────────────────────────
    op.add_column(
        'fiscal_years',
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
    )

    # ── slaughter_records ─────────────────────────────────────────────
    op.add_column(
        'slaughter_records',
        sa.Column('direct_labour_cost', sa.Numeric(precision=18, scale=4), nullable=True),
    )
    op.add_column(
        'slaughter_records',
        sa.Column('overhead_cost', sa.Numeric(precision=18, scale=4), nullable=True),
    )
    op.add_column(
        'slaughter_records',
        sa.Column('total_production_cost', sa.Numeric(precision=18, scale=4), nullable=True),
    )
    op.add_column(
        'slaughter_records',
        sa.Column('cost_per_kg', sa.Numeric(precision=18, scale=4), nullable=True),
    )
    op.add_column(
        'slaughter_records',
        sa.Column('production_journal_id', sa.Integer(), nullable=True),
    )
    # Note: FK to journal_entries intentionally not added to avoid circular dep issues
    # FK constraint can be added manually if needed

    # ── batches ───────────────────────────────────────────────────────
    op.add_column(
        'batches',
        sa.Column('chick_cost', sa.Numeric(precision=18, scale=4), nullable=True, server_default='0'),
    )
    # Add tenant_id to batches (needed for accounting trigger scoping)
    op.add_column(
        'batches',
        sa.Column('tenant_id', sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        'fk_batches_tenant_id',
        'batches', 'tenants',
        ['tenant_id'], ['id'],
        ondelete='SET NULL',
    )
    op.create_index('ix_batches_tenant_id', 'batches', ['tenant_id'])


def downgrade() -> None:
    op.drop_index('ix_batches_tenant_id', table_name='batches')
    op.drop_constraint('fk_batches_tenant_id', 'batches', type_='foreignkey')
    op.drop_column('batches', 'tenant_id')
    op.drop_column('batches', 'chick_cost')
    op.drop_column('slaughter_records', 'production_journal_id')
    op.drop_column('slaughter_records', 'cost_per_kg')
    op.drop_column('slaughter_records', 'total_production_cost')
    op.drop_column('slaughter_records', 'overhead_cost')
    op.drop_column('slaughter_records', 'direct_labour_cost')
    op.drop_column('fiscal_years', 'closed_at')
    op.drop_constraint('fk_journal_entries_reversal_of', 'journal_entries', type_='foreignkey')
    op.drop_column('journal_entries', 'reversal_of_id')
    op.drop_column('journal_entries', 'is_reversed')
