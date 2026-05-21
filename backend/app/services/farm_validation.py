"""
Shared Farm Validation Service

Centralized validation logic for farm operations including batch status checks,
capacity validation, stock availability validation, and operational workflow guards.
Used by mortality, vaccination, and medication workflows.
"""

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

from app.models.farm import Batch, BatchStatus, MortalityLog, VaccinationLog, MedicationAdministration
from app.models.inventory import StockItem
from app.services.inventory_coordinator import InventoryCoordinator


class FarmValidationError(Exception):
    """Custom exception for farm validation errors."""
    pass


class FarmValidationService:
    """
    Shared validation service for farm operations.
    
    Provides centralized validation for:
    - Batch status and active quantity checks
    - Stock availability for medicines/vaccines
    - Operational workflow state validation
    - Mortality quantity validation against batch
    """

    def __init__(self, db: AsyncSession | Session):
        self.db = db
        self.is_async = isinstance(db, AsyncSession)

    async def _get_batch_async(self, batch_id: int) -> Batch | None:
        """Get batch with async session."""
        result = await self.db.execute(
            select(Batch).where(Batch.id == batch_id)
        )
        return result.scalar_one_or_none()

    def _get_batch_sync(self, batch_id: int) -> Batch | None:
        """Get batch with sync session."""
        return self.db.query(Batch).filter(Batch.id == batch_id).first()

    async def _get_stock_item_async(self, item_id: int) -> StockItem | None:
        """Get stock item with async session."""
        result = await self.db.execute(
            select(StockItem).where(StockItem.id == item_id)
        )
        return result.scalar_one_or_none()

    def _get_stock_item_sync(self, item_id: int) -> StockItem | None:
        """Get stock item with sync session."""
        return self.db.query(StockItem).filter(StockItem.id == item_id).first()

    async def get_batch(self, batch_id: int) -> Batch:
        """Get batch by ID with appropriate session type."""
        if self.is_async:
            batch = await self._get_batch_async(batch_id)
        else:
            batch = self._get_batch_sync(batch_id)
        
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        return batch

    async def get_stock_item(self, item_id: int) -> StockItem:
        """Get stock item by ID with appropriate session type."""
        if self.is_async:
            item = await self._get_stock_item_async(item_id)
        else:
            item = self._get_stock_item_sync(item_id)
        
        if not item:
            raise HTTPException(status_code=404, detail="Stock item not found")
        return item

    async def validate_batch_active(self, batch_id: int) -> Batch:
        """
        Validate that a batch is in active status.
        
        Raises HTTPException if batch is not active.
        """
        batch = await self.get_batch(batch_id)
        if batch.status != BatchStatus.ACTIVE:
            raise HTTPException(
                status_code=400,
                detail=f"Batch {batch.batch_number} is not active. Current status: {batch.status.value}. "
                f"Operations can only be performed on active batches."
            )
        return batch

    async def validate_mortality_quantity(self, batch_id: int, mortality_quantity: int) -> Batch:
        """
        Validate that mortality quantity does not exceed batch active quantity.
        
        Raises HTTPException if mortality would exceed available birds.
        """
        batch = await self.validate_batch_active(batch_id)
        if mortality_quantity <= 0:
            raise HTTPException(status_code=400, detail="Mortality quantity must be greater than zero")
        if mortality_quantity > batch.active_quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Mortality quantity ({mortality_quantity}) exceeds batch active quantity ({batch.active_quantity}). "
                f"Cannot record more deaths than available birds."
            )
        return batch

    async def validate_stock_availability(
        self,
        stock_item_id: int,
        required_quantity: float,
    ) -> StockItem:
        """
        Validate that sufficient stock is available for a medicine/vaccine.
        
        Raises HTTPException if insufficient stock.
        """
        item = await self.get_stock_item(stock_item_id)
        if not item.is_active:
            raise HTTPException(status_code=400, detail=f"Stock item {item.name} is not active")
        
        if required_quantity <= 0:
            raise HTTPException(status_code=400, detail="Required quantity must be greater than zero")
        
        if item.current_quantity < required_quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {item.name}. Required: {required_quantity} {item.unit_of_measure}, "
                f"Available: {item.current_quantity} {item.unit_of_measure}"
            )
        return item

    async def validate_vaccination_workflow(
        self,
        batch_id: int,
        vaccine_item_id: int | None,
        dosage_per_bird: float | None,
        birds_to_vaccinate: int,
    ) -> tuple[Batch, StockItem | None]:
        """
        Validate vaccination workflow parameters.
        
        - Batch must be active
        - Birds to vaccinate must not exceed batch active quantity
        - If vaccine item specified, validate stock availability
        - Calculate total dosage if not provided
        """
        batch = await self.validate_batch_active(batch_id)
        
        if birds_to_vaccinate <= 0:
            raise HTTPException(status_code=400, detail="Birds to vaccinate must be greater than zero")
        
        if birds_to_vaccinate > batch.active_quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Birds to vaccinate ({birds_to_vaccinate}) exceeds batch active quantity ({batch.active_quantity})"
            )
        
        vaccine_item = None
        if vaccine_item_id:
            vaccine_item = await self.get_stock_item(vaccine_item_id)
            
            if dosage_per_bird is None or dosage_per_bird <= 0:
                raise HTTPException(status_code=400, detail="Dosage per bird must be specified and greater than zero")
            
            total_dosage = dosage_per_bird * birds_to_vaccinate
            await self.validate_stock_availability(vaccine_item_id, total_dosage)
        
        return batch, vaccine_item

    async def validate_medication_workflow(
        self,
        batch_id: int,
        medicine_item_id: int,
        total_quantity_used: float,
        birds_treated: int,
    ) -> tuple[Batch, StockItem]:
        """
        Validate medication administration workflow parameters.
        
        - Batch must be active
        - Birds treated must not exceed batch active quantity
        - Medicine stock must be available
        - Total quantity must be positive
        """
        batch = await self.validate_batch_active(batch_id)
        
        if birds_treated <= 0:
            raise HTTPException(status_code=400, detail="Birds treated must be greater than zero")
        
        if birds_treated > batch.active_quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Birds treated ({birds_treated}) exceeds batch active quantity ({batch.active_quantity})"
            )
        
        if total_quantity_used <= 0:
            raise HTTPException(status_code=400, detail="Total quantity used must be greater than zero")
        
        medicine_item = await self.validate_stock_availability(medicine_item_id, total_quantity_used)
        
        return batch, medicine_item

    async def record_mortality_stock_adjustment(
        self,
        batch_id: int,
        mortality_quantity: int,
        notes: str | None = None,
    ) -> None:
        """
        Record stock adjustment for mortality (reducing live bird count).
        
        This is called after mortality is recorded to update the batch's
        associated stock item quantity.
        """
        batch = await self.get_batch(batch_id)
        
        if batch.stock_item_id:
            coordinator = InventoryCoordinator(self.db)
            if self.is_async:
                await coordinator.record_out_async(
                    item_id=batch.stock_item_id,
                    quantity=float(mortality_quantity),
                    reference_type="mortality",
                    reference_id=batch_id,
                    notes=notes or f"Mortality adjustment for batch {batch.batch_number}",
                )
            else:
                coordinator.record_out(
                    item_id=batch.stock_item_id,
                    quantity=float(mortality_quantity),
                    reference_type="mortality",
                    reference_id=batch_id,
                    notes=notes or f"Mortality adjustment for batch {batch.batch_number}",
                )

    async def record_vaccination_stock_movement(
        self,
        vaccine_item_id: int,
        quantity_used: float,
        batch_id: int,
        notes: str | None = None,
    ) -> None:
        """
        Record stock movement for vaccine administration.
        
        Deducts vaccine from medicine stock.
        """
        coordinator = InventoryCoordinator(self.db)
        if self.is_async:
            await coordinator.record_out_async(
                item_id=vaccine_item_id,
                quantity=quantity_used,
                reference_type="vaccination",
                reference_id=batch_id,
                notes=notes or f"Vaccine administration for batch #{batch_id}",
            )
        else:
            coordinator.record_out(
                item_id=vaccine_item_id,
                quantity=quantity_used,
                reference_type="vaccination",
                reference_id=batch_id,
                notes=notes or f"Vaccine administration for batch #{batch_id}",
            )

    async def record_medication_stock_movement(
        self,
        medicine_item_id: int,
        quantity_used: float,
        batch_id: int,
        notes: str | None = None,
    ) -> None:
        """
        Record stock movement for medication administration.
        
        Deducts medicine from stock.
        """
        coordinator = InventoryCoordinator(self.db)
        if self.is_async:
            await coordinator.record_out_async(
                item_id=medicine_item_id,
                quantity=quantity_used,
                reference_type="medication",
                reference_id=batch_id,
                notes=notes or f"Medication administration for batch #{batch_id}",
            )
        else:
            coordinator.record_out(
                item_id=medicine_item_id,
                quantity=quantity_used,
                reference_type="medication",
                reference_id=batch_id,
                notes=notes or f"Medication administration for batch #{batch_id}",
            )
