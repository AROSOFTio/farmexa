"""
InventoryCoordinator Service

Single source of truth for all stock movements across the entire system.
All modules (Farm, Feed, Slaughter, Sales, Inventory) must use this service
to ensure consistent inventory tracking, audit trails, and transaction integrity.
"""

from datetime import datetime, timezone
from typing import Optional
from enum import Enum

from fastapi import HTTPException
from sqlalchemy import case, select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.models.inventory import MovementType, StockItem, StockMovement


class ReferenceType(str, Enum):
    """Standardized reference types for stock movements across all modules."""
    BATCH_ARRIVAL = "batch_arrival"
    BATCH_ADJUSTMENT = "batch_adjustment"
    MORTALITY = "mortality"
    SLAUGHTER_INPUT = "slaughter_input"
    SLAUGHTER_OUTPUT = "slaughter_output"
    FEED_PURCHASE = "feed_purchase"
    FEED_PRODUCTION_INPUT = "feed_production_input"
    FEED_PRODUCTION_OUTPUT = "feed_production_output"
    FEED_CONSUMPTION = "feed_consumption"
    SALE = "sale"
    RETURN = "return"
    STOCK_TRANSFER = "stock_transfer"
    MANUAL_ADJUSTMENT = "manual_adjustment"
    INITIAL_STOCK = "initial_stock"


class InventoryCoordinator:
    """
    Centralized inventory movement service.
    
    All stock quantity changes in the system must pass through this service.
    This ensures:
    - Consistent audit trail via StockMovement records
    - Atomic transactions with proper error handling
    - Row locking to prevent race conditions
    - Validation of stock availability for OUT movements
    - Average cost calculation for IN movements
    """

    def __init__(self, db: AsyncSession | Session):
        self.db = db
        self.is_async = isinstance(db, AsyncSession)

    async def _get_item_async(self, item_id: int) -> Optional[StockItem]:
        """Get stock item with row locking for async operations."""
        result = await self.db.execute(
            select(StockItem)
            .where(StockItem.id == item_id)
            .with_for_update()
        )
        return result.scalar_one_or_none()

    def _get_item_sync(self, item_id: int) -> Optional[StockItem]:
        """Get stock item with row locking for sync operations."""
        return self.db.query(StockItem).filter(StockItem.id == item_id).with_for_update().first()

    def _get_item(self, item_id: int) -> Optional[StockItem]:
        """Get stock item with appropriate locking based on session type."""
        if self.is_async:
            # For async, we'll handle this in the async methods
            raise NotImplementedError("Use async method for AsyncSession")
        return self._get_item_sync(item_id)

    def _calculate_average_cost(
        self,
        current_quantity: float,
        current_average_cost: float,
        incoming_quantity: float,
        incoming_unit_cost: float
    ) -> float:
        """
        Calculate weighted average cost for inventory items.
        
        Formula: (Current Value + Incoming Value) / (Current Qty + Incoming Qty)
        """
        if current_quantity + incoming_quantity == 0:
            return current_average_cost
        current_value = current_quantity * current_average_cost
        incoming_value = incoming_quantity * incoming_unit_cost
        return (current_value + incoming_value) / (current_quantity + incoming_quantity)

    async def record_movement_async(
        self,
        *,
        item_id: int,
        movement_type: MovementType,
        quantity: float,
        reference_type: str,
        reference_id: Optional[int] = None,
        unit_cost: Optional[float] = None,
        notes: Optional[str] = None,
        allow_negative: bool = False,
    ) -> StockMovement:
        """
        Record a stock movement (async version).
        
        This is the main entry point for all stock movements in async contexts.
        
        Args:
            item_id: Stock item ID
            movement_type: IN, OUT, or ADJUSTMENT
            quantity: Quantity to move. IN/OUT require positive values; ADJUSTMENT accepts signed deltas.
            reference_type: Type of transaction causing this movement
            reference_id: ID of the transaction record
            unit_cost: Unit cost for IN movements (for average cost calculation)
            notes: Optional notes/description
            allow_negative: Whether to allow negative stock (default False)
        
        Returns:
            Created StockMovement record
        
        Raises:
            HTTPException: If stock item not found or insufficient stock for OUT movement
        """
        if movement_type in {MovementType.IN, MovementType.OUT} and quantity <= 0:
            raise HTTPException(status_code=400, detail="Movement quantity must be positive")
        if movement_type == MovementType.ADJUSTMENT and quantity == 0:
            raise HTTPException(status_code=400, detail="Adjustment quantity cannot be zero")

        item = await self._get_item_async(item_id)
        if not item:
            raise HTTPException(status_code=404, detail=f"Stock item {item_id} not found")

        previous_quantity = item.current_quantity
        new_quantity = previous_quantity

        if movement_type == MovementType.IN:
            new_quantity += quantity
            if unit_cost is not None and new_quantity > 0:
                item.average_cost = self._calculate_average_cost(
                    previous_quantity, item.average_cost, quantity, unit_cost
                )

        elif movement_type == MovementType.OUT:
            if previous_quantity < quantity and not allow_negative:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for item {item.name}. Available: {previous_quantity}, Required: {quantity}"
                )
            new_quantity -= quantity

        elif movement_type == MovementType.ADJUSTMENT:
            new_quantity += quantity
            if new_quantity < 0 and not allow_negative:
                raise HTTPException(
                    status_code=400,
                    detail=f"Adjustment would result in negative stock for item {item.name}"
                )

        # Create movement record
        movement = StockMovement(
            item_id=item.id,
            movement_type=movement_type,
            quantity=quantity,
            previous_quantity=previous_quantity,
            new_quantity=new_quantity,
            reference_type=reference_type,
            reference_id=reference_id,
            unit_cost=unit_cost or item.average_cost,
            notes=notes,
        )

        # Update item quantity
        item.current_quantity = new_quantity

        self.db.add(movement)
        await self.db.flush()

        return movement

    def record_movement(
        self,
        *,
        item_id: int,
        movement_type: MovementType,
        quantity: float,
        reference_type: str,
        reference_id: Optional[int] = None,
        unit_cost: Optional[float] = None,
        notes: Optional[str] = None,
        allow_negative: bool = False,
    ) -> StockMovement:
        """
        Record a stock movement (sync version for compatibility with existing code).
        
        This is the main entry point for all stock movements in sync contexts.
        
        Args:
            item_id: Stock item ID
            movement_type: IN, OUT, or ADJUSTMENT
            quantity: Quantity to move. IN/OUT require positive values; ADJUSTMENT accepts signed deltas.
            reference_type: Type of transaction causing this movement
            reference_id: ID of the transaction record
            unit_cost: Unit cost for IN movements (for average cost calculation)
            notes: Optional notes/description
            allow_negative: Whether to allow negative stock (default False)
        
        Returns:
            Created StockMovement record
        
        Raises:
            HTTPException: If stock item not found or insufficient stock for OUT movement
        """
        if movement_type in {MovementType.IN, MovementType.OUT} and quantity <= 0:
            raise HTTPException(status_code=400, detail="Movement quantity must be positive")
        if movement_type == MovementType.ADJUSTMENT and quantity == 0:
            raise HTTPException(status_code=400, detail="Adjustment quantity cannot be zero")

        item = self._get_item_sync(item_id)
        if not item:
            raise HTTPException(status_code=404, detail=f"Stock item {item_id} not found")

        previous_quantity = item.current_quantity
        new_quantity = previous_quantity

        if movement_type == MovementType.IN:
            new_quantity += quantity
            if unit_cost is not None and new_quantity > 0:
                item.average_cost = self._calculate_average_cost(
                    previous_quantity, item.average_cost, quantity, unit_cost
                )

        elif movement_type == MovementType.OUT:
            if previous_quantity < quantity and not allow_negative:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for item {item.name}. Available: {previous_quantity}, Required: {quantity}"
                )
            new_quantity -= quantity

        elif movement_type == MovementType.ADJUSTMENT:
            new_quantity += quantity
            if new_quantity < 0 and not allow_negative:
                raise HTTPException(
                    status_code=400,
                    detail=f"Adjustment would result in negative stock for item {item.name}"
                )

        # Create movement record
        movement = StockMovement(
            item_id=item.id,
            movement_type=movement_type,
            quantity=quantity,
            previous_quantity=previous_quantity,
            new_quantity=new_quantity,
            reference_type=reference_type,
            reference_id=reference_id,
            unit_cost=unit_cost or item.average_cost,
            notes=notes,
        )

        # Update item quantity
        item.current_quantity = new_quantity

        self.db.add(movement)
        self.db.flush()

        return movement

    async def record_in_async(
        self,
        *,
        item_id: int,
        quantity: float,
        reference_type: str,
        reference_id: Optional[int] = None,
        unit_cost: Optional[float] = None,
        notes: Optional[str] = None,
    ) -> StockMovement:
        """Convenience method for recording IN movements (async)."""
        return await self.record_movement_async(
            item_id=item_id,
            movement_type=MovementType.IN,
            quantity=quantity,
            reference_type=reference_type,
            reference_id=reference_id,
            unit_cost=unit_cost,
            notes=notes,
        )

    def record_in(
        self,
        *,
        item_id: int,
        quantity: float,
        reference_type: str,
        reference_id: Optional[int] = None,
        unit_cost: Optional[float] = None,
        notes: Optional[str] = None,
    ) -> StockMovement:
        """Convenience method for recording IN movements (sync)."""
        return self.record_movement(
            item_id=item_id,
            movement_type=MovementType.IN,
            quantity=quantity,
            reference_type=reference_type,
            reference_id=reference_id,
            unit_cost=unit_cost,
            notes=notes,
        )

    async def record_out_async(
        self,
        *,
        item_id: int,
        quantity: float,
        reference_type: str,
        reference_id: Optional[int] = None,
        notes: Optional[str] = None,
    ) -> StockMovement:
        """Convenience method for recording OUT movements (async)."""
        return await self.record_movement_async(
            item_id=item_id,
            movement_type=MovementType.OUT,
            quantity=quantity,
            reference_type=reference_type,
            reference_id=reference_id,
            notes=notes,
        )

    def record_out(
        self,
        *,
        item_id: int,
        quantity: float,
        reference_type: str,
        reference_id: Optional[int] = None,
        notes: Optional[str] = None,
    ) -> StockMovement:
        """Convenience method for recording OUT movements (sync)."""
        return self.record_movement(
            item_id=item_id,
            movement_type=MovementType.OUT,
            quantity=quantity,
            reference_type=reference_type,
            reference_id=reference_id,
            notes=notes,
        )

    async def record_adjustment_async(
        self,
        *,
        item_id: int,
        quantity: float,
        reference_type: str,
        reference_id: Optional[int] = None,
        notes: Optional[str] = None,
        allow_negative: bool = False,
    ) -> StockMovement:
        """Convenience method for recording ADJUSTMENT movements (async)."""
        return await self.record_movement_async(
            item_id=item_id,
            movement_type=MovementType.ADJUSTMENT,
            quantity=quantity,
            reference_type=reference_type,
            reference_id=reference_id,
            notes=notes,
            allow_negative=allow_negative,
        )

    def record_adjustment(
        self,
        *,
        item_id: int,
        quantity: float,
        reference_type: str,
        reference_id: Optional[int] = None,
        notes: Optional[str] = None,
        allow_negative: bool = False,
    ) -> StockMovement:
        """Convenience method for recording ADJUSTMENT movements (sync)."""
        return self.record_movement(
            item_id=item_id,
            movement_type=MovementType.ADJUSTMENT,
            quantity=quantity,
            reference_type=reference_type,
            reference_id=reference_id,
            notes=notes,
            allow_negative=allow_negative,
        )

    async def reconcile_item_async(self, item_id: int) -> dict:
        """
        Reconcile stock item quantity against movement history.
        
        Calculates what the current quantity should be based on all movements,
        and compares it to the actual current_quantity field.
        
        Returns:
            Dict with:
            - actual_quantity: current_quantity from database
            - calculated_quantity: sum of all movements
            - difference: actual - calculated
            - is_reconciled: boolean indicating if they match
        """
        item = await self._get_item_async(item_id)
        if not item:
            raise HTTPException(status_code=404, detail=f"Stock item {item_id} not found")

        # Calculate net movement (IN adds, OUT subtracts, ADJUSTMENT can be either)
        result = await self.db.execute(
            select(
                func.sum(
                    case(
                        (StockMovement.movement_type == MovementType.IN, StockMovement.quantity),
                        (StockMovement.movement_type == MovementType.OUT, -StockMovement.quantity),
                        (StockMovement.movement_type == MovementType.ADJUSTMENT, StockMovement.quantity),
                        else_=0
                    )
                )
            ).where(StockMovement.item_id == item_id)
        )
        net_movement = result.scalar() or 0

        # For reconciliation, we need to account for initial stock properly
        # This is a simplified version - in production you'd track initial stock separately
        calculated_quantity = net_movement

        difference = item.current_quantity - calculated_quantity
        is_reconciled = abs(difference) < 0.01  # Allow for floating point precision

        return {
            "item_id": item_id,
            "item_name": item.name,
            "actual_quantity": item.current_quantity,
            "calculated_quantity": calculated_quantity,
            "difference": difference,
            "is_reconciled": is_reconciled,
        }

    def reconcile_item(self, item_id: int) -> dict:
        """Sync version of reconcile_item."""
        item = self._get_item_sync(item_id)
        if not item:
            raise HTTPException(status_code=404, detail=f"Stock item {item_id} not found")

        # Calculate net movement
        result = self.db.query(
            func.sum(
                case(
                    (StockMovement.movement_type == MovementType.IN, StockMovement.quantity),
                    (StockMovement.movement_type == MovementType.OUT, -StockMovement.quantity),
                    (StockMovement.movement_type == MovementType.ADJUSTMENT, StockMovement.quantity),
                    else_=0
                )
            )
        ).filter(StockMovement.item_id == item_id).first()
        net_movement = result[0] or 0

        calculated_quantity = net_movement
        difference = item.current_quantity - calculated_quantity
        is_reconciled = abs(difference) < 0.01

        return {
            "item_id": item_id,
            "item_name": item.name,
            "actual_quantity": item.current_quantity,
            "calculated_quantity": calculated_quantity,
            "difference": difference,
            "is_reconciled": is_reconciled,
        }
