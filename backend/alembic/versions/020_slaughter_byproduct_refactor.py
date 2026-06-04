"""Refactor slaughter byproducts with stock item and store location linkage

Revision ID: 020
Revises: 019_grn_giv_stores
Create Date: 2026-05-21

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '020'
down_revision = '019_grn_giv_stores'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'slaughter_byproducts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('slaughter_record_id', sa.Integer(), nullable=False),
        sa.Column('stock_item_id', sa.Integer(), nullable=True),
        sa.Column('store_location_id', sa.Integer(), nullable=True),
        sa.Column('byproduct_name', sa.String(length=100), nullable=False),
        sa.Column('quantity_weight', sa.Float(), nullable=False),
        sa.Column('unit', sa.String(length=20), nullable=False, server_default='kg'),
        sa.Column('value', sa.Float(), nullable=True, server_default='0.0'),
        sa.Column('unit_cost', sa.Float(), nullable=True),
        sa.Column('total_value', sa.Float(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['slaughter_record_id'], ['slaughter_records.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['stock_item_id'], ['stock_items.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['store_location_id'], ['store_locations.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_slaughter_byproducts_id', 'slaughter_byproducts', ['id'])
    op.create_index('ix_slaughter_byproducts_stock_item_id', 'slaughter_byproducts', ['stock_item_id'])
    op.create_index('ix_slaughter_byproducts_store_location_id', 'slaughter_byproducts', ['store_location_id'])


def downgrade():
    op.drop_index('ix_slaughter_byproducts_store_location_id', table_name='slaughter_byproducts')
    op.drop_index('ix_slaughter_byproducts_stock_item_id', table_name='slaughter_byproducts')
    op.drop_index('ix_slaughter_byproducts_id', table_name='slaughter_byproducts')
    op.drop_table('slaughter_byproducts')
