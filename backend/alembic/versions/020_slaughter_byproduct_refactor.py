"""Refactor slaughter byproducts with stock item and store location linkage

Revision ID: 020
Revises: 019
Create Date: 2026-05-21

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '020'
down_revision = '019'
branch_labels = None
depends_on = None


def upgrade():
    # Add stock_item_id column to slaughter_byproducts
    op.add_column('slaughter_byproducts', sa.Column('stock_item_id', sa.Integer(), nullable=True))
    
    # Add store_location_id column to slaughter_byproducts
    op.add_column('slaughter_byproducts', sa.Column('store_location_id', sa.Integer(), nullable=True))
    
    # Create foreign key constraint for stock_item_id
    op.create_foreign_key(
        'fk_slaughter_byproducts_stock_item',
        'slaughter_byproducts', 'stock_items',
        ['stock_item_id'], ['id']
    )
    
    # Create foreign key constraint for store_location_id
    op.create_foreign_key(
        'fk_slaughter_byproducts_store_location',
        'slaughter_byproducts', 'store_locations',
        ['store_location_id'], ['id']
    )
    
    # Create indexes
    op.create_index('ix_slaughter_byproducts_stock_item_id', 'slaughter_byproducts', ['stock_item_id'])
    op.create_index('ix_slaughter_byproducts_store_location_id', 'slaughter_byproducts', ['store_location_id'])
    
    # Add unit_cost and total_value columns for better inventory tracking
    op.add_column('slaughter_byproducts', sa.Column('unit_cost', sa.Float(), nullable=True))
    op.add_column('slaughter_byproducts', sa.Column('total_value', sa.Float(), nullable=True))


def downgrade():
    # Remove added columns
    op.drop_column('slaughter_byproducts', 'total_value')
    op.drop_column('slaughter_byproducts', 'unit_cost')
    
    # Remove indexes
    op.drop_index('ix_slaughter_byproducts_store_location_id', table_name='slaughter_byproducts')
    op.drop_index('ix_slaughter_byproducts_stock_item_id', table_name='slaughter_byproducts')
    
    # Remove foreign keys
    op.drop_constraint('fk_slaughter_byproducts_store_location', 'slaughter_byproducts', type_='foreignkey')
    op.drop_constraint('fk_slaughter_byproducts_stock_item', 'slaughter_byproducts', type_='foreignkey')
    
    # Remove columns
    op.drop_column('slaughter_byproducts', 'store_location_id')
    op.drop_column('slaughter_byproducts', 'stock_item_id')
