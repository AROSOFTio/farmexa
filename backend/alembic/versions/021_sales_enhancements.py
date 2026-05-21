"""Enhance sales module with customer details, invoice/delivery PDF support

Revision ID: 021
Revises: 020
Create Date: 2026-05-21

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '021'
down_revision = '020'
branch_labels = None
depends_on = None


def upgrade():
    # Add new columns to customers table
    op.add_column('customers', sa.Column('credit_limit', sa.Float(), nullable=False, server_default='0.0'))
    op.add_column('customers', sa.Column('payment_terms_days', sa.Integer(), nullable=False, server_default='30'))
    op.add_column('customers', sa.Column('tax_id', sa.String(), nullable=True))
    op.add_column('customers', sa.Column('contact_person', sa.String(), nullable=True))
    op.add_column('customers', sa.Column('contact_phone', sa.String(), nullable=True))
    op.add_column('customers', sa.Column('notes', sa.Text(), nullable=True))
    
    # Add PDF generation columns to invoices table
    op.add_column('invoices', sa.Column('pdf_generated_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('invoices', sa.Column('pdf_file_path', sa.String(), nullable=True))
    op.add_column('invoices', sa.Column('notes', sa.Text(), nullable=True))
    
    # Create delivery_notes table
    op.create_table(
        'delivery_notes',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('delivery_number', sa.String(), nullable=False),
        sa.Column('order_id', sa.Integer(), sa.ForeignKey('orders.id'), nullable=True),
        sa.Column('customer_id', sa.Integer(), sa.ForeignKey('customers.id'), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('delivery_date', sa.Date(), nullable=False),
        sa.Column('delivery_address', sa.Text(), nullable=True),
        sa.Column('contact_person', sa.String(), nullable=True),
        sa.Column('contact_phone', sa.String(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('pdf_generated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('pdf_file_path', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('delivered_at', sa.DateTime(timezone=True), nullable=True)
    )
    
    # Create indexes for delivery_notes
    op.create_index('ix_delivery_notes_delivery_number', 'delivery_notes', ['delivery_number'], unique=True)
    op.create_index('ix_delivery_notes_order_id', 'delivery_notes', ['order_id'])
    op.create_index('ix_delivery_notes_customer_id', 'delivery_notes', ['customer_id'])
    op.create_index('ix_delivery_notes_status', 'delivery_notes', ['status'])


def downgrade():
    # Drop delivery_notes table
    op.drop_index('ix_delivery_notes_status', table_name='delivery_notes')
    op.drop_index('ix_delivery_notes_customer_id', table_name='delivery_notes')
    op.drop_index('ix_delivery_notes_order_id', table_name='delivery_notes')
    op.drop_index('ix_delivery_notes_delivery_number', table_name='delivery_notes')
    op.drop_table('delivery_notes')
    
    # Remove PDF generation columns from invoices
    op.drop_column('invoices', 'notes')
    op.drop_column('invoices', 'pdf_file_path')
    op.drop_column('invoices', 'pdf_generated_at')
    
    # Remove new columns from customers
    op.drop_column('customers', 'notes')
    op.drop_column('customers', 'contact_phone')
    op.drop_column('customers', 'contact_person')
    op.drop_column('customers', 'tax_id')
    op.drop_column('customers', 'payment_terms_days')
    op.drop_column('customers', 'credit_limit')
