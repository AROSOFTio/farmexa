from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from email.message import EmailMessage
import smtplib
import threading
import uuid

from fastapi import HTTPException, status
from sqlalchemy import case, func
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.models.inventory import MovementType, StockItem, StockMovement
from app.models.sales import (
    Customer,
    DeliveryNote,
    DeliveryStatus,
    Invoice,
    InvoiceBalanceReminder,
    InvoiceStatus,
    Order,
    OrderItem,
    Payment,
)
from app.models.settings import EmailLog
from app.services.inventory_coordinator import InventoryCoordinator, ReferenceType
from app.services.accounting_service import AccountingService

from . import schemas


class SalesService:
    def compute_customer_balance(self, db: Session, customer_id: int) -> Decimal:
        """Derive live AR balance from open invoices (ignores stale customers.balance column)."""
        balance = (
            db.query(
                func.coalesce(
                    func.sum(
                        case(
                            (
                                Invoice.status != InvoiceStatus.CANCELLED,
                                Invoice.total_amount - Invoice.paid_amount,
                            ),
                            else_=Decimal("0"),
                        )
                    ),
                    0,
                )
            )
            .filter(Invoice.customer_id == customer_id)
            .scalar()
        )
        return Decimal(str(balance or 0))

    def serialize_customer(self, db: Session, customer: Customer) -> schemas.CustomerOut:
        out = schemas.CustomerOut.model_validate(customer)
        out.balance = self.compute_customer_balance(db, customer.id)
        return out

    def _send_customer_email(self, db: Session, invoice: Invoice, *, email_type: str, subject: str, body: str) -> str:
        customer = invoice.customer
        if not customer or not customer.email:
            return "skipped_no_customer_email"

        sender_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USERNAME or "farmexa@arosoftlabs.com"
        sender_name = settings.SMTP_FROM_NAME or "Farmexa"
        log = EmailLog(
            tenant_id=None,
            recipient=customer.email,
            sender=f"{sender_name} <{sender_email}>",
            email_type=email_type,
            subject=subject,
            body_preview=body[:500],
            status="pending",
        )
        db.add(log)
        db.flush()

        if not settings.SMTP_HOST:
            log.status = "skipped"
            log.error_message = "SMTP_HOST is not configured."
            return log.status

        _recipient = customer.email
        _sender_display = log.sender
        _subject = subject
        _body = body

        def _send_in_background() -> None:
            try:
                msg = EmailMessage()
                msg["From"] = _sender_display
                msg["To"] = _recipient
                msg["Subject"] = _subject
                msg.set_content(_body)
                with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=8) as server:
                    if settings.SMTP_USE_TLS:
                        server.starttls()
                    if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
                        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
                    server.send_message(msg)
            except Exception:  # pragma: no cover - external SMTP
                pass

        threading.Thread(target=_send_in_background, daemon=True).start()
        log.status = "queued"
        return log.status

    def _send_invoice_balance_email(self, db: Session, invoice: Invoice, *, reason: str) -> str:
        balance = max(float(invoice.total_amount or 0) - float(invoice.paid_amount or 0), 0)
        body = (
            f"Hello {invoice.customer.name if invoice.customer else 'Customer'},\n\n"
            f"Invoice {invoice.invoice_number} has a balance of UGX {balance:,.0f}.\n"
            f"Total: UGX {float(invoice.total_amount or 0):,.0f}\n"
            f"Paid: UGX {float(invoice.paid_amount or 0):,.0f}\n"
            f"Due date: {invoice.due_date}\n\n"
            "Thank you.\nFarmexa"
        )
        return self._send_customer_email(
            db,
            invoice,
            email_type=reason,
            subject=f"Farmexa invoice {invoice.invoice_number} balance",
            body=body,
        )

    def _schedule_balance_reminders(self, db: Session, invoice: Invoice) -> None:
        balance = max(float(invoice.total_amount or 0) - float(invoice.paid_amount or 0), 0)
        if balance <= 0:
            return
        reminder_dates = {
            "due_in_7_days": invoice.due_date - timedelta(days=7),
            "due_tomorrow": invoice.due_date - timedelta(days=1),
            "overdue_7_days": invoice.due_date + timedelta(days=7),
        }
        for reminder_type, scheduled_for in reminder_dates.items():
            existing = (
                db.query(InvoiceBalanceReminder)
                .filter(
                    InvoiceBalanceReminder.invoice_id == invoice.id,
                    InvoiceBalanceReminder.reminder_type == reminder_type,
                )
                .first()
            )
            if existing:
                existing.scheduled_for = scheduled_for
                continue
            db.add(
                InvoiceBalanceReminder(
                    invoice_id=invoice.id,
                    customer_id=invoice.customer_id,
                    reminder_type=reminder_type,
                    scheduled_for=scheduled_for,
                    status="pending",
                )
            )

    def get_customers(self, db: Session, skip: int = 0, limit: int = 100):
        customers = (
            db.query(Customer).order_by(Customer.created_at.desc()).offset(skip).limit(limit).all()
        )
        return [self.serialize_customer(db, customer) for customer in customers]

    def get_customer_balance(self, db: Session, customer_id: int) -> schemas.CustomerBalanceOut:
        customer = db.query(Customer).filter(Customer.id == customer_id).first()
        if not customer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
        return schemas.CustomerBalanceOut(
            customer_id=customer.id,
            balance=self.compute_customer_balance(db, customer.id),
        )

    def get_orders(self, db: Session, skip: int = 0, limit: int = 100):
        return (
            db.query(Order)
            .options(joinedload(Order.customer), joinedload(Order.items))
            .order_by(Order.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def create_customer(self, db: Session, customer: schemas.CustomerCreate):
        existing = db.query(Customer).filter(Customer.name == customer.name).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Customer already exists")

        db_customer = Customer(**customer.model_dump())
        db.add(db_customer)
        db.commit()
        db.refresh(db_customer)
        return self.serialize_customer(db, db_customer)

    def create_order(self, db: Session, order: schemas.OrderCreate):
        customer = db.query(Customer).filter(Customer.id == order.customer_id, Customer.is_active.is_(True)).first()
        if not customer:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Customer not found or inactive")

        if not order.items:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one order line is required")

        total_amount = Decimal("0")
        db_order = Order(
            customer_id=order.customer_id, 
            status=order.status, 
            notes=order.notes, 
            total_amount=0.0, 
            batch_id=order.batch_id
        )
        db.add(db_order)
        db.flush()

        for item in order.items:
            stock = db.query(StockItem).filter(StockItem.id == item.product_id, StockItem.is_active.is_(True)).first()
            if not stock:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Stock item {item.product_id} is not available",
                )

            if stock.current_quantity < item.quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Insufficient stock for {stock.name}",
                )

            subtotal = item.quantity * item.unit_price
            total_amount += subtotal

            db.add(
                OrderItem(
                    order_id=db_order.id,
                    product_id=item.product_id,
                    quantity=item.quantity,
                    unit_price=item.unit_price,
                    subtotal=subtotal,
                    batch_id=item.batch_id,
                )
            )

            # Use InventoryCoordinator for stock movement
            coordinator = InventoryCoordinator(db)
            coordinator.record_out(
                item_id=stock.id,
                quantity=float(item.quantity),
                reference_type=ReferenceType.SALE.value,
                reference_id=db_order.id,
                notes=f"Order {db_order.id}",
                batch_id=item.batch_id,
            )

        db_order.total_amount = total_amount

        invoice = Invoice(
            invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
            order_id=db_order.id,
            customer_id=db_order.customer_id,
            status=InvoiceStatus.ISSUED,
            issue_date=date.today(),
            due_date=date.today() + timedelta(days=14),
            total_amount=total_amount,
            paid_amount=0.0,
            batch_id=order.batch_id,
        )
        db.add(invoice)

        db.flush()

        from app.models.tenant import Tenant
        tenant = db.query(Tenant).first()
        tenant_id = tenant.id if tenant else None
        accounting = AccountingService(db, tenant_id=tenant_id)
        accounting.record_egg_sales(
            revenue=total_amount,
            entry_date=invoice.issue_date,
            reference_id=invoice.id,
            is_cash=False,  # This creates AR
            created_by_user_id=None,
            batch_id=order.batch_id,
        )

        db.commit()

        return (
            db.query(Order)
            .options(joinedload(Order.customer), joinedload(Order.items))
            .filter(Order.id == db_order.id)
            .first()
        )

    def get_invoices(self, db: Session, skip: int = 0, limit: int = 100):
        return (
            db.query(Invoice)
            .options(
                joinedload(Invoice.customer),
                joinedload(Invoice.payments),
                joinedload(Invoice.order).joinedload(Order.items).joinedload(OrderItem.product),
            )
            .order_by(Invoice.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_invoice(self, db: Session, invoice_id: int):
        invoice = (
            db.query(Invoice)
            .options(
                joinedload(Invoice.customer),
                joinedload(Invoice.payments),
                joinedload(Invoice.order).joinedload(Order.items).joinedload(OrderItem.product),
            )
            .filter(Invoice.id == invoice_id)
            .first()
        )
        if not invoice:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")
        return invoice

    def add_payment(self, db: Session, invoice_id: int, payment: schemas.PaymentCreate):
        invoice = (
            db.query(Invoice)
            .options(joinedload(Invoice.customer))
            .filter(Invoice.id == invoice_id)
            .first()
        )
        if not invoice:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice not found")

        outstanding_amount = max(invoice.total_amount - invoice.paid_amount, 0)
        if payment.amount > outstanding_amount:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment amount exceeds the invoice outstanding balance",
            )

        db_payment = Payment(
            invoice_id=invoice_id,
            amount=payment.amount,
            payment_method=payment.payment_method,
            payment_date=payment.payment_date,
            reference=payment.reference,
        )
        db.add(db_payment)

        invoice.paid_amount += payment.amount
        if invoice.paid_amount >= invoice.total_amount:
            invoice.status = InvoiceStatus.PAID
        elif invoice.paid_amount > 0:
            invoice.status = InvoiceStatus.PARTIAL

        if invoice.paid_amount >= invoice.total_amount:
            db.query(InvoiceBalanceReminder).filter(
                InvoiceBalanceReminder.invoice_id == invoice.id,
                InvoiceBalanceReminder.status == "pending",
            ).update({"status": "cancelled"})
        else:
            self._schedule_balance_reminders(db, invoice)
        self._send_customer_email(
            db,
            invoice,
            email_type="Payment Received",
            subject=f"Payment received for invoice {invoice.invoice_number}",
            body=(
                f"Hello {invoice.customer.name if invoice.customer else 'Customer'},\n\n"
                f"We received UGX {payment.amount:,.0f} for invoice {invoice.invoice_number}.\n"
                f"Outstanding balance: UGX {max(invoice.total_amount - invoice.paid_amount, 0):,.0f}\n\n"
                "Thank you.\nFarmexa"
            ),
        )
        
        db.flush()
        
        from app.models.tenant import Tenant
        tenant = db.query(Tenant).first()
        tenant_id = tenant.id if tenant else None
        accounting = AccountingService(db, tenant_id=tenant_id)
        accounting.record_payment_received(
            payment_amount=payment.amount,
            entry_date=payment.payment_date,
            reference_id=db_payment.id,
            created_by_user_id=None,
        )

        db.commit()
        db.refresh(db_payment)
        return db_payment

    def process_due_balance_reminders(self, db: Session) -> int:
        reminders = (
            db.query(InvoiceBalanceReminder)
            .options(joinedload(InvoiceBalanceReminder.invoice).joinedload(Invoice.customer))
            .filter(
                InvoiceBalanceReminder.status == "pending",
                InvoiceBalanceReminder.scheduled_for <= date.today(),
            )
            .limit(100)
            .all()
        )
        processed = 0
        for reminder in reminders:
            invoice = reminder.invoice
            if invoice is None:
                reminder.status = "skipped"
                reminder.last_error = "Invoice not found."
                processed += 1
                continue
            balance = max(float(invoice.total_amount or 0) - float(invoice.paid_amount or 0), 0)
            if balance <= 0:
                reminder.status = "cancelled"
                processed += 1
                continue
            status_text = self._send_invoice_balance_email(
                db,
                invoice,
                reason=f"Balance Reminder {reminder.reminder_type}",
            )
            reminder.status = status_text
            if status_text == "sent":
                reminder.sent_at = datetime.now(UTC)
            else:
                reminder.last_error = status_text
            processed += 1
        db.commit()
        return processed

    def checkout_pos(self, db: Session, payload: schemas.PosCheckoutCreate):
        expected_total = sum(float(item.quantity) * float(item.unit_price) for item in payload.items)
        if payload.sale_payment_mode == "full":
            requested_paid = expected_total if payload.amount_paid_now is None else float(payload.amount_paid_now)
        else:
            requested_paid = float(payload.amount_paid_now or 0)

        # cash_tendered is the physical cash given by the customer (can exceed total for change)
        cash_tendered = float(payload.cash_tendered or 0) if payload.cash_tendered is not None else requested_paid

        if requested_paid < 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Amount paid cannot be negative")
        # NOTE: cash_tendered CAN exceed total — the excess is returned as change.
        # requested_paid (amount credited to invoice) must not exceed total.
        if requested_paid > expected_total:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Amount credited to the invoice cannot exceed the sale total",
            )
        if payload.sale_payment_mode == "full" and requested_paid != expected_total:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Full payment must match the sale total",
            )
        if payload.sale_payment_mode == "partial" and not (0 < requested_paid < expected_total):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Partial payment must be greater than zero and less than the sale total",
            )
        if requested_paid > 0 and not payload.payment_method:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment method is required when money is received",
            )
        if expected_total - requested_paid > 0 and not payload.customer_id:
            has_contact = bool((payload.customer_email or "").strip() or (payload.customer_phone or "").strip())
            has_named_customer = bool((payload.customer_name or "").strip().lower() not in {"", "walk-in customer"})
            if not has_contact or not has_named_customer:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Credit or partial sales require a named customer with email or phone contact.",
                )

        customer = None
        if payload.customer_id:
            customer = db.query(Customer).filter(Customer.id == payload.customer_id, Customer.is_active.is_(True)).first()
            if not customer:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selected customer is not active")
        else:
            customer = db.query(Customer).filter(Customer.name == payload.customer_name).first()
            if not customer:
                customer = Customer(
                    name=payload.customer_name or "Walk-in Customer",
                    customer_type="retail",
                    email=payload.customer_email,
                    phone=payload.customer_phone,
                    is_active=True,
                )
                db.add(customer)
                db.flush()
            else:
                if payload.customer_email and not customer.email:
                    customer.email = payload.customer_email
                if payload.customer_phone and not customer.phone:
                    customer.phone = payload.customer_phone

        order = self.create_order(
            db,
            schemas.OrderCreate(
                customer_id=customer.id,
                status="completed",
                notes=payload.notes,
                batch_id=payload.batch_id,
                items=[
                    schemas.OrderItemCreate(
                        product_id=item.product_id,
                        quantity=item.quantity,
                        unit_price=item.unit_price,
                        batch_id=item.batch_id,
                    )
                    for item in payload.items
                ],
            ),
        )
        invoice = (
            db.query(Invoice)
            .options(
                joinedload(Invoice.customer),
                joinedload(Invoice.payments),
                joinedload(Invoice.order).joinedload(Order.items).joinedload(OrderItem.product),
            )
            .filter(Invoice.order_id == order.id)
            .first()
        )
        if not invoice:
            raise HTTPException(status_code=500, detail="POS invoice was not generated")

        invoice_total = float(invoice.total_amount or 0)
        if payload.sale_payment_mode == "full":
            amount_paid_now = invoice_total if payload.amount_paid_now is None else float(payload.amount_paid_now)
        elif payload.sale_payment_mode == "partial":
            amount_paid_now = float(payload.amount_paid_now or 0)
        else:
            amount_paid_now = float(payload.amount_paid_now or 0)

        # Effective cash tendered (for change calculation)
        effective_cash_tendered = float(payload.cash_tendered or 0) if payload.cash_tendered is not None else amount_paid_now
        # Change = cash given minus what is owed on this sale (clamped to 0)
        change_to_return = max(effective_cash_tendered - amount_paid_now, 0.0)

        balance_due = max(invoice_total - amount_paid_now, 0)
        if balance_due > 0:
            if customer.name.lower().strip() == "walk-in customer" and not (customer.email or customer.phone):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Credit or partial sales require a named customer with email or phone contact.",
                )
            invoice.due_date = payload.credit_due_date or date.today() + timedelta(days=14)
            invoice.status = InvoiceStatus.ISSUED
            self._schedule_balance_reminders(db, invoice)
            db.commit()
            email_status = "balance_reminders_scheduled"
        else:
            email_status = "ready"

        payment = None
        if amount_paid_now > 0:
            payment = self.add_payment(
                db,
                invoice.id,
                schemas.PaymentCreate(
                    amount=amount_paid_now,
                    payment_method=payload.payment_method,
                    payment_date=date.today(),
                    reference=payload.payment_reference,
                ),
            )
        invoice = (
            db.query(Invoice)
            .options(
                joinedload(Invoice.customer),
                joinedload(Invoice.payments),
                joinedload(Invoice.order).joinedload(Order.items).joinedload(OrderItem.product),
            )
            .filter(Invoice.id == invoice.id)
            .first()
        )
        final_balance = max(invoice.total_amount - invoice.paid_amount, 0)
        if final_balance > 0:
            email_status = self._send_invoice_balance_email(db, invoice, reason="Customer Balance Statement")
            db.commit()
        return {
            "receipt_number": f"RCP-{invoice.invoice_number}",
            "order": order,
            "invoice": invoice,
            "payment": payment,
            "balance_due": final_balance,
            "change_to_return": change_to_return,
            "cash_tendered": effective_cash_tendered,
            "email_status": email_status if final_balance > 0 else "sent_or_logged",
        }

    def update_customer(self, db: Session, customer_id: int, customer: schemas.CustomerUpdate):
        db_customer = db.query(Customer).filter(Customer.id == customer_id).first()
        if not db_customer:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")

        update_data = customer.model_dump(exclude_unset=True, exclude_none=True)
        for key, value in update_data.items():
            setattr(db_customer, key, value)

        db.commit()
        db.refresh(db_customer)
        return self.serialize_customer(db, db_customer)

    def get_delivery_notes(self, db: Session, skip: int = 0, limit: int = 100):
        return (
            db.query(DeliveryNote)
            .options(joinedload(DeliveryNote.customer), joinedload(DeliveryNote.order))
            .order_by(DeliveryNote.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_delivery_note(self, db: Session, note_id: int):
        note = (
            db.query(DeliveryNote)
            .options(joinedload(DeliveryNote.customer), joinedload(DeliveryNote.order))
            .filter(DeliveryNote.id == note_id)
            .first()
        )
        if not note:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery note not found")
        return note

    def create_delivery_note(self, db: Session, delivery_note: schemas.DeliveryNoteCreate):
        customer = db.query(Customer).filter(Customer.id == delivery_note.customer_id, Customer.is_active.is_(True)).first()
        if not customer:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Customer not found or inactive")

        if delivery_note.order_id:
            order = db.query(Order).filter(Order.id == delivery_note.order_id).first()
            if not order:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order not found")
            if order.customer_id != delivery_note.customer_id:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order belongs to a different customer")

        db_note = DeliveryNote(
            delivery_number=f"DEL-{uuid.uuid4().hex[:8].upper()}",
            **delivery_note.model_dump(exclude_none=True),
        )
        db.add(db_note)
        db.commit()
        db.refresh(db_note)
        return db_note

    def update_delivery_note(self, db: Session, note_id: int, updates: schemas.DeliveryNoteUpdate):
        note = db.query(DeliveryNote).filter(DeliveryNote.id == note_id).first()
        if not note:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery note not found")

        update_data = updates.model_dump(exclude_unset=True, exclude_none=True)
        for key, value in update_data.items():
            setattr(note, key, value)

        # Set delivered_at when status changes to delivered
        if updates.status == DeliveryStatus.DELIVERED and note.delivered_at is None:
            note.delivered_at = datetime.now(UTC)

        db.commit()
        db.refresh(note)
        return note

    def delete_delivery_note(self, db: Session, note_id: int):
        note = db.query(DeliveryNote).filter(DeliveryNote.id == note_id).first()
        if not note:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Delivery note not found")

        db.delete(note)
        db.commit()
        return {"message": "Delivery note deleted successfully"}


sales_service = SalesService()

