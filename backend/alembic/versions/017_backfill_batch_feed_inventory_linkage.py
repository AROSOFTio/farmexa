"""
Backfill Batch and FeedItem inventory linkage and initial movements.

Idempotent migration that:
- Ensures each Batch has a stock_item_id (creates a StockItem per breed 'Live Birds - {breed}')
- Creates initial IN StockMovement for batches based on initial_quantity if no prior movement exists
- Ensures each FeedItem has a stock_item_id (creates StockItem per item name)
- Creates initial IN StockMovement for feed items based on current_stock if not already migrated

This migration intentionally avoids strict unit costs and uses average_cost defaults.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import orm, select


revision = "017_backfill_batch_feed_inventory_linkage"
down_revision = "016_feed_stock_linkage"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    session = orm.Session(bind=bind)

    # Reflect minimal tables
    meta = sa.MetaData()
    meta.bind = bind

    stock_items = sa.Table("stock_items", meta, autoload_with=bind)
    stock_movements = sa.Table("stock_movements", meta, autoload_with=bind)
    batches = sa.Table("batches", meta, autoload_with=bind)
    feed_items = sa.Table("feed_items", meta, autoload_with=bind)

    # Helper to get/create stock item by name & category
    def get_or_create_stock_item(name: str, category: str, unit: str, reorder: float = 0.0):
        si = session.execute(select(stock_items).where(stock_items.c.name == name)).first()
        if si:
            return si[0]
        ins = stock_items.insert().values(
            name=name,
            sku=None,
            category=sa.text("'" + category + "'::stockcategory"),
            unit_of_measure=unit,
            current_quantity=0.0,
            reorder_level=reorder or 0.0,
            unit_price=0.0,
            average_cost=0.0,
            description=f"Auto backfill for {name}",
            is_active=True,
        ).returning(stock_items)
        return session.execute(ins).first()[0]

    # Backfill batches
    for row in session.execute(select(batches)).all():
        b = row[0]
        stock_item_id = getattr(b, "stock_item_id", None)
        breed = getattr(b, "breed", None) or "Birds"
        active_qty = float(getattr(b, "active_quantity", 0) or 0)
        initial_qty = float(getattr(b, "initial_quantity", 0) or 0)
        if not stock_item_id:
            name = f"Live Birds - {breed}"
            si = get_or_create_stock_item(name, "finished_product", "birds", 0.0)
            session.execute(
                batches.update().where(batches.c.id == b.id).values(stock_item_id=si.id)
            )
            stock_item_id = si.id
        # Create initial movement only if none exists referencing this batch
        existing = session.execute(
            select(sa.func.count()).select_from(stock_movements).where(
                (stock_movements.c.item_id == stock_item_id)
                & (stock_movements.c.reference_type == sa.literal("batch_arrival"))
                & (stock_movements.c.reference_id == b.id)
            )
        ).scalar() or 0
        if existing == 0 and initial_qty > 0:
            prev = session.execute(select(stock_items.c.current_quantity).where(stock_items.c.id == stock_item_id)).scalar() or 0.0
            new_qty = prev + initial_qty
            session.execute(
                stock_movements.insert().values(
                    item_id=stock_item_id,
                    movement_type=sa.text("'in'::movementtype"),
                    quantity=initial_qty,
                    previous_quantity=prev,
                    new_quantity=new_qty,
                    reference_type="batch_arrival",
                    reference_id=b.id,
                    unit_cost=None,
                    notes=f"Backfill arrival for batch {getattr(b, 'batch_number', b.id)}",
                )
            )
            session.execute(
                stock_items.update().where(stock_items.c.id == stock_item_id).values(current_quantity=new_qty)
            )

    # Backfill feed items
    for row in session.execute(select(feed_items)).all():
        f = row[0]
        stock_item_id = getattr(f, "stock_item_id", None)
        name = getattr(f, "name", None) or "Feed Item"
        unit = getattr(f, "unit", None) or "kg"
        current_stock = float(getattr(f, "current_stock", 0) or 0)
        reorder = float(getattr(f, "reorder_threshold", 0) or 0)
        if not stock_item_id:
            si = get_or_create_stock_item(name, "raw_material", unit, reorder)
            session.execute(
                feed_items.update().where(feed_items.c.id == f.id).values(stock_item_id=si.id)
            )
            stock_item_id = si.id
        existing = session.execute(
            select(sa.func.count()).select_from(stock_movements).where(
                (stock_movements.c.item_id == stock_item_id)
                & (stock_movements.c.reference_type == sa.literal("initial_stock"))
                & (stock_movements.c.reference_id == f.id)
            )
        ).scalar() or 0
        if existing == 0 and current_stock > 0:
            prev = session.execute(select(stock_items.c.current_quantity).where(stock_items.c.id == stock_item_id)).scalar() or 0.0
            new_qty = prev + current_stock
            session.execute(
                stock_movements.insert().values(
                    item_id=stock_item_id,
                    movement_type=sa.text("'in'::movementtype"),
                    quantity=current_stock,
                    previous_quantity=prev,
                    new_quantity=new_qty,
                    reference_type="initial_stock",
                    reference_id=f.id,
                    unit_cost=None,
                    notes=f"Backfill feed item stock for {name}",
                )
            )
            session.execute(
                stock_items.update().where(stock_items.c.id == stock_item_id).values(current_quantity=new_qty)
            )

    session.commit()


def downgrade() -> None:
    # This downgrade is non-destructive: we only unlink stock_item_id; we do not remove stock movements.
    bind = op.get_bind()
    session = orm.Session(bind=bind)
    meta = sa.MetaData()
    meta.bind = bind
    batches = sa.Table("batches", meta, autoload_with=bind)
    feed_items = sa.Table("feed_items", meta, autoload_with=bind)
    # Set links to NULL (keeps movements and stock balances intact)
    session.execute(batches.update().values(stock_item_id=None))
    session.execute(feed_items.update().values(stock_item_id=None))
    session.commit()
