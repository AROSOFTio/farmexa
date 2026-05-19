"""
Backfill Batch and FeedItem inventory linkage and initial movements.

Idempotent migration that:
- Ensures each Batch has a stock_item_id (creates a StockItem per breed 'Live Birds - {breed}')
- Creates opening balance IN StockMovement for batches based on active_quantity
- Ensures each FeedItem has a stock_item_id (creates StockItem per item name)
- Creates initial IN StockMovement for feed items based on current_stock if not already migrated

This migration intentionally avoids strict unit costs and uses average_cost defaults.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy import orm, select


# Keep revision identifiers within Alembic's default varchar(32) version column.
revision = "017_batch_feed_inventory_link"
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

    # Helper to get/create stock item by name & category; returns stock_item_id (int)
    def get_or_create_stock_item_id(name: str, category: str, unit: str, reorder: float = 0.0) -> int:
        si = session.execute(select(stock_items.c.id).where(stock_items.c.name == name)).scalar()
        if si:
            return int(si)
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
        ).returning(stock_items.c.id)
        return int(session.execute(ins).scalar_one())

    # Backfill batches
    for b in session.execute(select(batches)).mappings().all():
        stock_item_id = b.get("stock_item_id")
        breed = b.get("breed") or "Birds"
        active_qty = float(b.get("active_quantity") or 0)
        if not stock_item_id:
            name = f"Live Birds - {breed}"
            stock_item_id = get_or_create_stock_item_id(name, "finished_product", "birds", 0.0)
            session.execute(
                batches.update().where(batches.c.id == b["id"]).values(stock_item_id=stock_item_id)
            )
        # Create or correct the migration opening balance only once per batch.
        existing_movement = session.execute(
            select(stock_movements).where(
                (stock_movements.c.item_id == stock_item_id)
                & (stock_movements.c.reference_type == sa.literal("batch_arrival"))
                & (stock_movements.c.reference_id == b["id"]) 
            )
        ).mappings().first()
        if existing_movement:
            existing_qty = float(existing_movement.get("quantity") or 0)
            delta = active_qty - existing_qty
            if abs(delta) > 0.0001:
                prev_stock = session.execute(
                    select(stock_items.c.current_quantity).where(stock_items.c.id == stock_item_id)
                ).scalar() or 0.0
                session.execute(
                    stock_items.update()
                    .where(stock_items.c.id == stock_item_id)
                    .values(current_quantity=prev_stock + delta)
                )
            session.execute(
                stock_movements.update()
                .where(stock_movements.c.id == existing_movement["id"])
                .values(
                    quantity=active_qty,
                    new_quantity=(float(existing_movement.get("previous_quantity") or 0) + active_qty),
                    notes=f"Migration opening balance for active birds in batch {b.get('batch_number') or b['id']}",
                )
            )
        elif active_qty > 0:
            prev = session.execute(select(stock_items.c.current_quantity).where(stock_items.c.id == stock_item_id)).scalar() or 0.0
            new_qty = prev + active_qty
            session.execute(
                stock_movements.insert().values(
                    item_id=stock_item_id,
                    movement_type=sa.text("'in'::movementtype"),
                    quantity=active_qty,
                    previous_quantity=prev,
                    new_quantity=new_qty,
                    reference_type="batch_arrival",
                    reference_id=b["id"],
                    unit_cost=None,
                    notes=f"Migration opening balance for active birds in batch {b.get('batch_number') or b['id']}",
                )
            )
            session.execute(
                stock_items.update().where(stock_items.c.id == stock_item_id).values(current_quantity=new_qty)
            )

    # Backfill feed items
    for f in session.execute(select(feed_items)).mappings().all():
        stock_item_id = f.get("stock_item_id")
        name = f.get("name") or "Feed Item"
        unit = f.get("unit") or "kg"
        current_stock = float(f.get("current_stock") or 0)
        reorder = float(f.get("reorder_threshold") or 0)
        if not stock_item_id:
            stock_item_id = get_or_create_stock_item_id(name, "raw_material", unit, reorder)
            session.execute(
                feed_items.update().where(feed_items.c.id == f["id"]).values(stock_item_id=stock_item_id)
            )
        existing = session.execute(
            select(sa.func.count()).select_from(stock_movements).where(
                (stock_movements.c.item_id == stock_item_id)
                & (stock_movements.c.reference_type == sa.literal("initial_stock"))
                & (stock_movements.c.reference_id == f["id"]) 
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
                    reference_id=f["id"],
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
