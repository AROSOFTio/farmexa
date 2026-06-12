"""
Procurement Service

Purchase order lifecycle (draft → submitted → approved → received), goods
receipt with inventory + journal automation, supplier invoices (AP), and
supplier payments. Journal entries:

- GRN:              Dr Inventory            Cr Accounts Payable
- Invoice approval: Dr Expense (non-PO)     Cr Accounts Payable
                    (PO-linked invoices skip the journal — the GRN already
                    accrued the liability; posting again would double-book AP)
- Payment:          Dr Accounts Payable     Cr Cash/Bank/Mobile Money
"""

import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import extract, func
from sqlalchemy.orm import Session, joinedload

from app.core.money import quantize_money
from app.models.procurement import (
    POStatus,
    PurchaseOrder,
    PurchaseOrderItem,
    SupplierInvoice,
    SupplierInvoiceStatus,
    SupplierPayment,
)
from app.modules.procurement import schemas

logger = logging.getLogger(__name__)


class ProcurementService:
    def __init__(self, db: Session, tenant_id: int):
        self.db = db
        self.tenant_id = tenant_id

    # ------------------------------------------------------------------
    # Purchase Orders
    # ------------------------------------------------------------------

    def _next_po_number(self) -> str:
        year = date.today().year
        count = (
            self.db.query(func.count(PurchaseOrder.id))
            .filter(
                PurchaseOrder.tenant_id == self.tenant_id,
                extract("year", PurchaseOrder.created_at) == year,
            )
            .scalar()
            or 0
        )
        return f"PO-{year}-{str(count + 1).zfill(4)}"

    def _po_query(self):
        return (
            self.db.query(PurchaseOrder)
            .options(joinedload(PurchaseOrder.supplier), joinedload(PurchaseOrder.items))
            .filter(PurchaseOrder.tenant_id == self.tenant_id)
        )

    def list_purchase_orders(
        self,
        status_filter: Optional[POStatus] = None,
        supplier_id: Optional[int] = None,
        branch_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[PurchaseOrder]:
        query = self._po_query()
        if status_filter is not None:
            query = query.filter(PurchaseOrder.status == status_filter)
        if supplier_id is not None:
            query = query.filter(PurchaseOrder.supplier_id == supplier_id)
        if branch_id is not None:
            query = query.filter(PurchaseOrder.branch_id == branch_id)
        return (
            query.order_by(PurchaseOrder.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_purchase_order(self, po_id: int) -> PurchaseOrder:
        po = self._po_query().filter(PurchaseOrder.id == po_id).first()
        if not po:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase order not found")
        return po

    def _recalculate_totals(self, po: PurchaseOrder) -> None:
        subtotal = Decimal("0")
        for item in po.items:
            item.total_price = quantize_money(
                Decimal(str(item.quantity_ordered or 0)) * Decimal(str(item.unit_price or 0))
            )
            subtotal += Decimal(str(item.total_price))
        po.subtotal = quantize_money(subtotal)
        po.total_amount = quantize_money(subtotal + Decimal(str(po.tax_amount or 0)))

    def create_purchase_order(self, data: schemas.PurchaseOrderCreate, created_by_id: int) -> PurchaseOrder:
        po = PurchaseOrder(
            tenant_id=self.tenant_id,
            po_number=self._next_po_number(),
            status=POStatus.DRAFT,
            created_by_id=created_by_id,
            **data.model_dump(exclude={"items"}),
        )
        self.db.add(po)
        self.db.flush()
        for item_data in data.items:
            self.db.add(PurchaseOrderItem(po_id=po.id, **item_data.model_dump()))
        self.db.flush()
        self.db.refresh(po)
        self._recalculate_totals(po)
        self.db.commit()
        return self.get_purchase_order(po.id)

    def update_purchase_order(self, po_id: int, data: schemas.PurchaseOrderUpdate) -> PurchaseOrder:
        po = self.get_purchase_order(po_id)
        if po.status != POStatus.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only draft purchase orders can be edited",
            )
        updates = data.model_dump(exclude_unset=True)
        items = updates.pop("items", None)
        for key, value in updates.items():
            setattr(po, key, value)
        if items is not None:
            for existing in list(po.items):
                self.db.delete(existing)
            self.db.flush()
            for item_data in items:
                self.db.add(PurchaseOrderItem(po_id=po.id, **item_data))
            self.db.flush()
            self.db.refresh(po)
        self._recalculate_totals(po)
        self.db.commit()
        return self.get_purchase_order(po.id)

    def submit_purchase_order(self, po_id: int) -> PurchaseOrder:
        po = self.get_purchase_order(po_id)
        if po.status != POStatus.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Only draft purchase orders can be submitted (current: {po.status.value})",
            )
        po.status = POStatus.SUBMITTED
        self.db.commit()
        return self.get_purchase_order(po.id)

    def reject_purchase_order(self, po_id: int) -> PurchaseOrder:
        """Send a submitted PO back to draft for corrections."""
        po = self.get_purchase_order(po_id)
        if po.status != POStatus.SUBMITTED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only submitted purchase orders can be rejected back to draft",
            )
        po.status = POStatus.DRAFT
        self.db.commit()
        return self.get_purchase_order(po.id)

    def approve_purchase_order(self, po_id: int, approved_by_id: int) -> PurchaseOrder:
        po = self.get_purchase_order(po_id)
        if po.status != POStatus.SUBMITTED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Only submitted purchase orders can be approved (current: {po.status.value})",
            )
        po.status = POStatus.APPROVED
        po.approved_by_id = approved_by_id
        po.approved_at = datetime.now(timezone.utc)
        self.db.commit()
        return self.get_purchase_order(po.id)

    def cancel_purchase_order(self, po_id: int) -> PurchaseOrder:
        po = self.get_purchase_order(po_id)
        if po.status in (POStatus.PARTIALLY_RECEIVED, POStatus.FULLY_RECEIVED, POStatus.CLOSED):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Purchase orders with received goods cannot be cancelled",
            )
        if po.status == POStatus.CANCELLED:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Purchase order is already cancelled")
        po.status = POStatus.CANCELLED
        self.db.commit()
        return self.get_purchase_order(po.id)

    def receive_goods(
        self, po_id: int, received_items: List[schemas.ReceiveItemIn], received_by_id: int
    ) -> PurchaseOrder:
        """Record a goods receipt: update quantities, move stock in, post the GRN journal."""
        from app.services.accounting_service import AccountingService
        from app.services.inventory_coordinator import InventoryCoordinator, ReferenceType

        po = self.get_purchase_order(po_id)
        if po.status not in (POStatus.APPROVED, POStatus.PARTIALLY_RECEIVED):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="PO must be approved to receive goods",
            )

        items_by_id = {item.id: item for item in po.items}
        total_received_value = Decimal("0")
        coordinator = InventoryCoordinator(self.db)

        for recv in received_items:
            item = items_by_id.get(recv.item_id)
            if not item:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"PO item {recv.item_id} does not belong to this purchase order",
                )
            qty = Decimal(str(recv.qty_received))
            outstanding = Decimal(str(item.quantity_ordered)) - Decimal(str(item.quantity_received or 0))
            if qty > outstanding:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot receive {qty} of '{item.description}': only {outstanding} outstanding",
                )
            item.quantity_received = Decimal(str(item.quantity_received or 0)) + qty

            if item.stock_item_id:
                try:
                    movement = coordinator.record_in(
                        item_id=item.stock_item_id,
                        quantity=float(qty),
                        unit_cost=float(item.unit_price or 0),
                        reference_type=ReferenceType.GRN_RECEIPT.value,
                        reference_id=po.id,
                        notes=f"GRN from PO {po.po_number}",
                    )
                    movement.branch_id = recv.branch_id or po.delivery_branch_id or po.branch_id
                except Exception as exc:
                    logger.warning("GRN stock update failed for PO %s item %s: %s", po.po_number, item.id, exc)

            total_received_value += qty * Decimal(str(item.unit_price or 0))

        all_received = all(
            Decimal(str(i.quantity_received or 0)) >= Decimal(str(i.quantity_ordered))
            for i in po.items
        )
        po.status = POStatus.FULLY_RECEIVED if all_received else POStatus.PARTIALLY_RECEIVED

        # GRN journal: Dr Inventory, Cr Accounts Payable
        if total_received_value > 0:
            total_received_value = quantize_money(total_received_value)
            try:
                acct = AccountingService(self.db, tenant_id=self.tenant_id)
                inv_code = acct.get_mapped_account_code("finished_goods", "1134")
                ap_code = acct.get_mapped_account_code("ap", "2110")
                supplier_name = po.supplier.name if po.supplier else ""
                acct.create_and_post_journal(
                    entry_date=date.today(),
                    description=f"GRN — PO {po.po_number} — {supplier_name}".strip(" —"),
                    reference_type="grn",
                    reference_id=po.id,
                    source_module="procurement",
                    created_by_user_id=received_by_id,
                    branch_id=po.delivery_branch_id or po.branch_id,
                    lines=[
                        {"account_code": inv_code, "debit": total_received_value, "credit": Decimal("0"),
                         "memo": f"Goods received — PO {po.po_number}"},
                        {"account_code": ap_code, "debit": Decimal("0"), "credit": total_received_value,
                         "memo": f"AP accrual — {supplier_name or po.po_number}"},
                    ],
                )
            except Exception as exc:
                logger.warning("GRN journal posting failed for PO %s: %s", po.po_number, exc)

        self.db.commit()
        return self.get_purchase_order(po.id)

    # ------------------------------------------------------------------
    # Supplier Invoices (AP)
    # ------------------------------------------------------------------

    def _get_invoice(self, invoice_id: int) -> SupplierInvoice:
        invoice = (
            self.db.query(SupplierInvoice)
            .options(joinedload(SupplierInvoice.supplier), joinedload(SupplierInvoice.payments))
            .filter(
                SupplierInvoice.id == invoice_id,
                SupplierInvoice.tenant_id == self.tenant_id,
            )
            .first()
        )
        if not invoice:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Supplier invoice not found")
        return invoice

    def list_supplier_invoices(
        self,
        status_filter: Optional[SupplierInvoiceStatus] = None,
        supplier_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> List[SupplierInvoice]:
        # Flag overdue invoices before listing (idempotent)
        today = date.today()
        overdue = (
            self.db.query(SupplierInvoice)
            .filter(
                SupplierInvoice.tenant_id == self.tenant_id,
                SupplierInvoice.status.in_([SupplierInvoiceStatus.APPROVED, SupplierInvoiceStatus.PARTIAL]),
                SupplierInvoice.due_date.isnot(None),
                SupplierInvoice.due_date < today,
            )
            .all()
        )
        if overdue:
            for inv in overdue:
                inv.status = SupplierInvoiceStatus.OVERDUE
            self.db.commit()

        query = (
            self.db.query(SupplierInvoice)
            .options(joinedload(SupplierInvoice.supplier))
            .filter(SupplierInvoice.tenant_id == self.tenant_id)
        )
        if status_filter is not None:
            query = query.filter(SupplierInvoice.status == status_filter)
        if supplier_id is not None:
            query = query.filter(SupplierInvoice.supplier_id == supplier_id)
        return (
            query.order_by(SupplierInvoice.invoice_date.desc(), SupplierInvoice.id.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_supplier_invoice(self, invoice_id: int) -> SupplierInvoice:
        return self._get_invoice(invoice_id)

    def create_supplier_invoice(self, data: schemas.SupplierInvoiceCreate) -> SupplierInvoice:
        if data.po_id:
            po = self.get_purchase_order(data.po_id)  # validates tenant ownership
            if po.supplier_id != data.supplier_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invoice supplier does not match the purchase order supplier",
                )
        invoice = SupplierInvoice(
            tenant_id=self.tenant_id,
            amount_paid=Decimal("0"),
            status=SupplierInvoiceStatus.DRAFT,
            **data.model_dump(),
        )
        self.db.add(invoice)
        self.db.commit()
        self.db.refresh(invoice)
        return self._get_invoice(invoice.id)

    def approve_supplier_invoice(self, invoice_id: int) -> SupplierInvoice:
        from app.services.accounting_service import AccountingService

        invoice = self._get_invoice(invoice_id)
        if invoice.status != SupplierInvoiceStatus.DRAFT:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Only draft invoices can be approved (current: {invoice.status.value})",
            )
        invoice.status = SupplierInvoiceStatus.APPROVED

        # PO-linked invoices skip the journal: the GRN already accrued
        # Dr Inventory / Cr AP, so posting again would double-book the liability.
        if not invoice.po_id:
            acct = AccountingService(self.db, tenant_id=self.tenant_id)
            ap_code = acct.get_mapped_account_code("ap", "2110")
            exp_code = acct.get_mapped_account_code("procurement_expense", "6800")
            total = quantize_money(Decimal(str(invoice.total_amount)))
            entry = acct.create_and_post_journal(
                entry_date=invoice.invoice_date,
                description=f"Supplier invoice {invoice.invoice_number}",
                reference_type="supplier_invoice",
                reference_id=invoice.id,
                source_module="procurement",
                branch_id=invoice.branch_id,
                lines=[
                    {"account_code": exp_code, "debit": total, "credit": Decimal("0"),
                     "memo": f"Invoice {invoice.invoice_number}"},
                    {"account_code": ap_code, "debit": Decimal("0"), "credit": total,
                     "memo": f"AP — {invoice.invoice_number}"},
                ],
            )
            invoice.journal_entry_id = entry.id

        self.db.commit()
        return self._get_invoice(invoice.id)

    # ------------------------------------------------------------------
    # Supplier Payments
    # ------------------------------------------------------------------

    def record_supplier_payment(
        self, invoice_id: int, payment_data: schemas.SupplierPaymentCreate, created_by_id: Optional[int] = None
    ) -> SupplierPayment:
        from app.services.accounting_service import AccountingService

        invoice = self._get_invoice(invoice_id)
        if invoice.status in (SupplierInvoiceStatus.DRAFT, SupplierInvoiceStatus.CANCELLED):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invoice must be approved before recording payments",
            )
        if invoice.status == SupplierInvoiceStatus.PAID:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invoice is already fully paid")

        amount = Decimal(str(payment_data.amount))
        balance = Decimal(str(invoice.total_amount)) - Decimal(str(invoice.amount_paid or 0))
        if amount > balance:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Payment {amount} exceeds outstanding balance {balance}",
            )

        payment = SupplierPayment(
            tenant_id=self.tenant_id,
            supplier_invoice_id=invoice_id,
            **payment_data.model_dump(),
        )
        self.db.add(payment)
        self.db.flush()

        invoice.amount_paid = quantize_money(Decimal(str(invoice.amount_paid or 0)) + amount)
        remaining = Decimal(str(invoice.total_amount)) - Decimal(str(invoice.amount_paid))
        invoice.status = SupplierInvoiceStatus.PAID if remaining <= 0 else SupplierInvoiceStatus.PARTIAL

        acct = AccountingService(self.db, tenant_id=self.tenant_id)
        ap_code = acct.get_mapped_account_code("ap", "2110")
        method_map = {
            "cash": ("cash", "1111"),
            "bank_transfer": ("bank", "1112"),
            "mobile_money": ("mobile_money", "1113"),
            "cheque": ("bank", "1112"),
        }
        op_key, default_code = method_map.get(payment.payment_method.value, ("cash", "1111"))
        cash_code = acct.get_mapped_account_code(op_key, default_code)
        entry = acct.create_and_post_journal(
            entry_date=payment.payment_date,
            description=f"Supplier payment — {invoice.invoice_number}",
            reference_type="supplier_payment",
            reference_id=payment.id,
            source_module="procurement",
            created_by_user_id=created_by_id,
            branch_id=invoice.branch_id,
            lines=[
                {"account_code": ap_code, "debit": amount, "credit": Decimal("0"),
                 "memo": f"Payment to supplier — {invoice.invoice_number}"},
                {"account_code": cash_code, "debit": Decimal("0"), "credit": amount,
                 "memo": f"Cash/bank outflow — {payment.reference or invoice.invoice_number}"},
            ],
        )
        payment.journal_entry_id = entry.id
        self.db.commit()
        self.db.refresh(payment)
        return payment

    # ------------------------------------------------------------------
    # PO PDF
    # ------------------------------------------------------------------

    def generate_po_pdf(self, po_id: int) -> bytes:
        """Generate a formatted purchase order PDF."""
        from io import BytesIO

        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import mm
        from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

        po = self.get_purchase_order(po_id)
        supplier = po.supplier

        buf = BytesIO()
        doc = SimpleDocTemplate(
            buf, pagesize=A4,
            leftMargin=20 * mm, rightMargin=20 * mm, topMargin=15 * mm, bottomMargin=15 * mm,
        )
        styles = getSampleStyleSheet()
        BRAND = colors.HexColor("#1D9E75")
        DARK = colors.HexColor("#1a1a2e")

        def money(v):
            return f"UGX {float(v or 0):,.2f}"

        def h(text, size=12, bold=True, color=DARK):
            tag = f"<font size={size} color={color.hexval()}>"
            return Paragraph(f"{tag}<b>{text}</b></font>" if bold else f"{tag}{text}</font>", styles["Normal"])

        story = []

        # Header
        story.append(h("FARMEXA ERP", 16, color=BRAND))
        story.append(h("PURCHASE ORDER", 13))
        story.append(Spacer(1, 4 * mm))

        # PO + supplier details
        meta_data = [
            ["PO Number:", po.po_number, "Order Date:", po.order_date.isoformat() if po.order_date else "—"],
            ["Status:", po.status.value.replace("_", " ").title(),
             "Expected Delivery:", po.expected_delivery_date.isoformat() if po.expected_delivery_date else "—"],
            ["Supplier:", supplier.name if supplier else "—",
             "Supplier Phone:", (supplier.phone if supplier else None) or "—"],
            ["Supplier Address:", (supplier.address if supplier else None) or "—",
             "Payment Terms:", (supplier.payment_terms if supplier else None) or "—"],
            ["Delivery Address:", po.delivery_address or "—", "", ""],
        ]
        mt = Table(meta_data, colWidths=[35 * mm, 65 * mm, 35 * mm, 35 * mm])
        mt.setStyle(TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.append(mt)
        story.append(Spacer(1, 6 * mm))

        # Items table
        items_data = [["#", "Description", "Qty", "UOM", "Unit Price", "Total"]]
        for idx, item in enumerate(po.items, start=1):
            items_data.append([
                str(idx),
                item.description,
                f"{float(item.quantity_ordered or 0):,.2f}",
                item.unit_of_measure or "—",
                money(item.unit_price),
                money(item.total_price),
            ])
        it = Table(items_data, colWidths=[10 * mm, 70 * mm, 20 * mm, 20 * mm, 25 * mm, 25 * mm])
        it.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), BRAND),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cccccc")),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(it)
        story.append(Spacer(1, 4 * mm))

        # Totals
        totals_data = [
            ["Subtotal", money(po.subtotal)],
            ["Tax", money(po.tax_amount)],
            ["GRAND TOTAL", money(po.total_amount)],
        ]
        tt = Table(totals_data, colWidths=[140 * mm, 30 * mm])
        tt.setStyle(TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
            ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
            ("TEXTCOLOR", (0, -1), (-1, -1), BRAND),
            ("LINEABOVE", (0, -1), (-1, -1), 0.7, BRAND),
            ("FONTSIZE", (0, -1), (-1, -1), 11),
            ("TOPPADDING", (0, -1), (-1, -1), 5),
        ]))
        story.append(tt)
        story.append(Spacer(1, 8 * mm))

        # Terms and conditions
        if po.terms_and_conditions:
            story.append(h("Terms and Conditions", 10))
            story.append(Spacer(1, 1 * mm))
            story.append(Paragraph(f"<font size=8>{po.terms_and_conditions}</font>", styles["Normal"]))
            story.append(Spacer(1, 6 * mm))
        if po.notes:
            story.append(h("Notes", 10))
            story.append(Spacer(1, 1 * mm))
            story.append(Paragraph(f"<font size=8>{po.notes}</font>", styles["Normal"]))
            story.append(Spacer(1, 6 * mm))

        # Signature lines
        story.append(Spacer(1, 12 * mm))
        sig_data = [["", "Prepared By", "", "Approved By"]]
        st = Table(sig_data, colWidths=[30 * mm, 60 * mm, 20 * mm, 60 * mm])
        st.setStyle(TableStyle([
            ("LINEABOVE", (1, 0), (1, 0), 0.5, colors.black),
            ("LINEABOVE", (3, 0), (3, 0), 0.5, colors.black),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ]))
        story.append(st)

        doc.build(story)
        return buf.getvalue()
