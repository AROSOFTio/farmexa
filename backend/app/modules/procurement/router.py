import io
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.deps import require_permission
from app.db.tenant_db import get_tenant_sync_db
from app.models.procurement import POStatus, SupplierInvoiceStatus
from app.modules.procurement import schemas
from app.modules.procurement.service import ProcurementService

router = APIRouter(prefix="/procurement", tags=["Procurement"])


# --- Purchase Orders ---

@router.post("/purchase-orders", response_model=schemas.PurchaseOrderOut, status_code=201)
def create_purchase_order(
    payload: schemas.PurchaseOrderCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("procurement:write")),
):
    service = ProcurementService(db, tenant_id=current_user.tenant_id)
    return service.create_purchase_order(payload, created_by_id=current_user.id)


@router.get("/purchase-orders", response_model=List[schemas.PurchaseOrderOut])
def list_purchase_orders(
    status: Optional[POStatus] = Query(None),
    supplier_id: Optional[int] = Query(None),
    branch_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("procurement:read")),
):
    service = ProcurementService(db, tenant_id=current_user.tenant_id)
    return service.list_purchase_orders(
        status_filter=status, supplier_id=supplier_id, branch_id=branch_id, skip=skip, limit=limit
    )


@router.get("/purchase-orders/{po_id}", response_model=schemas.PurchaseOrderOut)
def get_purchase_order(
    po_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("procurement:read")),
):
    service = ProcurementService(db, tenant_id=current_user.tenant_id)
    return service.get_purchase_order(po_id)


@router.patch("/purchase-orders/{po_id}", response_model=schemas.PurchaseOrderOut)
def update_purchase_order(
    po_id: int,
    payload: schemas.PurchaseOrderUpdate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("procurement:write")),
):
    service = ProcurementService(db, tenant_id=current_user.tenant_id)
    return service.update_purchase_order(po_id, payload)


@router.post("/purchase-orders/{po_id}/submit", response_model=schemas.PurchaseOrderOut)
def submit_purchase_order(
    po_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("procurement:write")),
):
    service = ProcurementService(db, tenant_id=current_user.tenant_id)
    return service.submit_purchase_order(po_id)


@router.post("/purchase-orders/{po_id}/approve", response_model=schemas.PurchaseOrderOut)
def approve_purchase_order(
    po_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("procurement:write")),
):
    service = ProcurementService(db, tenant_id=current_user.tenant_id)
    return service.approve_purchase_order(po_id, approved_by_id=current_user.id)


@router.post("/purchase-orders/{po_id}/reject", response_model=schemas.PurchaseOrderOut)
def reject_purchase_order(
    po_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("procurement:write")),
):
    service = ProcurementService(db, tenant_id=current_user.tenant_id)
    return service.reject_purchase_order(po_id)


@router.post("/purchase-orders/{po_id}/cancel", response_model=schemas.PurchaseOrderOut)
def cancel_purchase_order(
    po_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("procurement:write")),
):
    service = ProcurementService(db, tenant_id=current_user.tenant_id)
    return service.cancel_purchase_order(po_id)


@router.post("/purchase-orders/{po_id}/receive", response_model=schemas.PurchaseOrderOut)
def receive_goods(
    po_id: int,
    payload: schemas.ReceiveGoodsRequest,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("procurement:write")),
):
    service = ProcurementService(db, tenant_id=current_user.tenant_id)
    return service.receive_goods(po_id, payload.received_items, received_by_id=current_user.id)


@router.get("/purchase-orders/{po_id}/pdf")
def get_purchase_order_pdf(
    po_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("procurement:read")),
):
    service = ProcurementService(db, tenant_id=current_user.tenant_id)
    po = service.get_purchase_order(po_id)
    pdf_data = service.generate_po_pdf(po_id)
    return StreamingResponse(
        io.BytesIO(pdf_data),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{po.po_number}.pdf"'},
    )


# --- Supplier Invoices ---

@router.post("/supplier-invoices", response_model=schemas.SupplierInvoiceOut, status_code=201)
def create_supplier_invoice(
    payload: schemas.SupplierInvoiceCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("procurement:write")),
):
    service = ProcurementService(db, tenant_id=current_user.tenant_id)
    return service.create_supplier_invoice(payload)


@router.get("/supplier-invoices", response_model=List[schemas.SupplierInvoiceOut])
def list_supplier_invoices(
    status: Optional[SupplierInvoiceStatus] = Query(None),
    supplier_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("procurement:read")),
):
    service = ProcurementService(db, tenant_id=current_user.tenant_id)
    return service.list_supplier_invoices(
        status_filter=status, supplier_id=supplier_id, skip=skip, limit=limit
    )


@router.get("/supplier-invoices/{invoice_id}", response_model=schemas.SupplierInvoiceOut)
def get_supplier_invoice(
    invoice_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("procurement:read")),
):
    service = ProcurementService(db, tenant_id=current_user.tenant_id)
    return service.get_supplier_invoice(invoice_id)


@router.post("/supplier-invoices/{invoice_id}/approve", response_model=schemas.SupplierInvoiceOut)
def approve_supplier_invoice(
    invoice_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("procurement:write")),
):
    service = ProcurementService(db, tenant_id=current_user.tenant_id)
    return service.approve_supplier_invoice(invoice_id)


@router.post("/supplier-invoices/{invoice_id}/pay", response_model=schemas.SupplierPaymentOut)
def pay_supplier_invoice(
    invoice_id: int,
    payload: schemas.SupplierPaymentCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("procurement:write")),
):
    service = ProcurementService(db, tenant_id=current_user.tenant_id)
    return service.record_supplier_payment(invoice_id, payload, created_by_id=current_user.id)


# --- Suppliers & Tentative Pricing ---

@router.get("/suppliers", response_model=List[schemas.SupplierOut])
def list_suppliers(
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("procurement:read")),
):
    service = ProcurementService(db, tenant_id=current_user.tenant_id)
    return service.list_suppliers()


@router.post("/suppliers", response_model=schemas.SupplierOut, status_code=201)
def create_supplier(
    payload: schemas.SupplierCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("procurement:write")),
):
    service = ProcurementService(db, tenant_id=current_user.tenant_id)
    return service.create_supplier(payload)


@router.put("/suppliers/{supplier_id}", response_model=schemas.SupplierOut)
def update_supplier(
    supplier_id: int,
    payload: schemas.SupplierUpdate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("procurement:write")),
):
    service = ProcurementService(db, tenant_id=current_user.tenant_id)
    return service.update_supplier(supplier_id, payload)


@router.get("/suppliers/{supplier_id}/prices", response_model=List[schemas.SupplierItemPriceOut])
def list_supplier_item_prices(
    supplier_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("procurement:read")),
):
    service = ProcurementService(db, tenant_id=current_user.tenant_id)
    return service.list_supplier_item_prices(supplier_id)


@router.post("/suppliers/{supplier_id}/prices", response_model=schemas.SupplierItemPriceOut)
def create_or_update_supplier_item_price(
    supplier_id: int,
    payload: schemas.SupplierItemPriceCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("procurement:write")),
):
    service = ProcurementService(db, tenant_id=current_user.tenant_id)
    return service.create_or_update_supplier_item_price(supplier_id, payload)


@router.delete("/suppliers/{supplier_id}/prices/{price_id}", status_code=204)
def delete_supplier_item_price(
    supplier_id: int,
    price_id: int,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("procurement:write")),
):
    service = ProcurementService(db, tenant_id=current_user.tenant_id)
    service.delete_supplier_item_price(supplier_id, price_id)
    return None

