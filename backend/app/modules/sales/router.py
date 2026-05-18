from typing import List

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.deps import require_permission
from app.db.tenant_db import get_tenant_sync_db
from app.modules.sales import schemas, service
from app.services.sales_documents import build_a4_receipt_pdf, build_thermal_receipt_pdf

router = APIRouter(prefix="/sales", tags=["Sales"])


@router.get("/customers", response_model=List[schemas.CustomerOut])
def list_customers(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("sales:read")),
):
    return service.sales_service.get_customers(db, skip, limit)


@router.post("/customers", response_model=schemas.CustomerOut)
def create_customer(
    customer: schemas.CustomerCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("sales:write")),
):
    return service.sales_service.create_customer(db, customer)


@router.get("/orders", response_model=List[schemas.OrderOut])
def list_orders(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("sales:read")),
):
    return service.sales_service.get_orders(db, skip, limit)


@router.post("/orders", response_model=schemas.OrderOut)
def create_order(
    order: schemas.OrderCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("sales:write")),
):
    return service.sales_service.create_order(db, order)


@router.get("/invoices", response_model=List[schemas.InvoiceOut])
def list_invoices(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("sales:read")),
):
    return service.sales_service.get_invoices(db, skip, limit)


@router.post("/invoices/{invoice_id}/payments", response_model=schemas.PaymentOut)
def add_payment(
    invoice_id: int,
    payment: schemas.PaymentCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("sales:write")),
):
    return service.sales_service.add_payment(db, invoice_id, payment)


@router.get("/invoices/{invoice_id}/receipt.pdf")
def download_invoice_receipt(
    invoice_id: int,
    paper: str = "a4",
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("sales:read")),
):
    normalized_paper = paper.lower()
    if normalized_paper not in {"a4", "58mm", "80mm"}:
        normalized_paper = "a4"
    invoice = service.sales_service.get_invoice(db, invoice_id)
    document = (
        build_a4_receipt_pdf(invoice, current_user)
        if normalized_paper == "a4"
        else build_thermal_receipt_pdf(invoice, current_user, normalized_paper)
    )
    return Response(
        content=document.content,
        media_type=document.media_type,
        headers={"Content-Disposition": f'inline; filename="{document.filename}"'},
    )


@router.get("/invoices/{invoice_id}/receipt-download.pdf")
def download_invoice_receipt_attachment(
    invoice_id: int,
    paper: str = "a4",
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("sales:read")),
):
    normalized_paper = paper.lower()
    if normalized_paper not in {"a4", "58mm", "80mm"}:
        normalized_paper = "a4"
    invoice = service.sales_service.get_invoice(db, invoice_id)
    document = (
        build_a4_receipt_pdf(invoice, current_user)
        if normalized_paper == "a4"
        else build_thermal_receipt_pdf(invoice, current_user, normalized_paper)
    )
    return Response(
        content=document.content,
        media_type=document.media_type,
        headers={"Content-Disposition": f'attachment; filename="{document.filename}"'},
    )


@router.post("/pos/checkout", response_model=schemas.PosCheckoutOut)
def checkout_pos(
    payload: schemas.PosCheckoutCreate,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("sales:write")),
):
    return service.sales_service.checkout_pos(db, payload)
