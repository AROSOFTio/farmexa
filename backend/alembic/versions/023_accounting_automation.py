"""accounting automation

Revision ID: 023
Revises: 7a6ece0657b6
Create Date: 2026-06-10 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '023'
down_revision = '7a6ece0657b6'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Add columns to journal_entries
    op.add_column('journal_entries', sa.Column('branch_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_journal_entries_branch_id'), 'journal_entries', ['branch_id'], unique=False)
    op.create_foreign_key('fk_je_branch_id', 'journal_entries', 'branches', ['branch_id'], ['id'], ondelete='SET NULL')

    # Add columns to journal_lines
    op.add_column('journal_lines', sa.Column('branch_id', sa.Integer(), nullable=True))
    op.add_column('journal_lines', sa.Column('batch_id', sa.Integer(), nullable=True))
    op.create_index(op.f('ix_journal_lines_branch_id'), 'journal_lines', ['branch_id'], unique=False)
    op.create_index(op.f('ix_journal_lines_batch_id'), 'journal_lines', ['batch_id'], unique=False)
    op.create_foreign_key('fk_jl_branch_id', 'journal_lines', 'branches', ['branch_id'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_jl_batch_id', 'journal_lines', 'batches', ['batch_id'], ['id'], ondelete='SET NULL')

    # Create system_account_mappings table
    op.create_table('system_account_mappings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=True),
        sa.Column('operation_key', sa.String(length=50), nullable=False),
        sa.Column('account_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['account_id'], ['accounts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('operation_key', 'tenant_id', name='uq_opkey_tenant')
    )
    op.create_index(op.f('ix_system_account_mappings_id'), 'system_account_mappings', ['id'], unique=False)
    op.create_index(op.f('ix_system_account_mappings_operation_key'), 'system_account_mappings', ['operation_key'], unique=False)
    op.create_index(op.f('ix_system_account_mappings_tenant_id'), 'system_account_mappings', ['tenant_id'], unique=False)


def downgrade() -> None:
    op.drop_table('system_account_mappings')

    op.drop_constraint('fk_jl_batch_id', 'journal_lines', type_='foreignkey')
    op.drop_constraint('fk_jl_branch_id', 'journal_lines', type_='foreignkey')
    op.drop_index(op.f('ix_journal_lines_batch_id'), table_name='journal_lines')
    op.drop_index(op.f('ix_journal_lines_branch_id'), table_name='journal_lines')
    op.drop_column('journal_lines', 'batch_id')
    op.drop_column('journal_lines', 'branch_id')

    op.drop_constraint('fk_je_branch_id', 'journal_entries', type_='foreignkey')
    op.drop_index(op.f('ix_journal_entries_branch_id'), table_name='journal_entries')
    op.drop_column('journal_entries', 'branch_id')
