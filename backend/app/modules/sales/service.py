from datetime import date, timedelta
import uuid

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.models.inventory import MovementType, StockItem, StockMovement
from app.models.sales import Customer, Invoice, InvoiceStatus, Order, OrderItem, Payment

from . import schemas


class SalesService:
    def get_customers(self, db: Session, skip: int = 0, limit: int = 100):
        return db.query(Customer).order_by(Customer.created_at.desc()).offset(skip).limit(limit).all()

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
        return db_customer

    def create_order(self, db: Session, order: schemas.OrderCreate):
        customer = db.query(Customer).filter(Customer.id == order.customer_id, Customer.is_active.is_(True)).first()
        if not customer:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Customer not found or inactive")

        if not order.items:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one order line is required")

        total_amount = 0.0
        db_order = Order(customer_id=order.customer_id, status=order.status, notes=order.notes, total_amount=0.0)
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
                )
            )

            previous_quantity = stock.current_quantity
            stock.current_quantity = previous_quantity - item.quantity

            db.add(
                StockMovement(
                    item_id=stock.id,
                    movement_type=MovementType.OUT,
                    quantity=item.quantity,
                    previous_quantity=previous_quantity,
                    new_quantity=stock.current_quantity,
                    reference_type="sale_order",
                    reference_id=db_order.id,
                    unit_cost=stock.average_cost,
                    notes=f"Order {db_order.id}",
                )
            )

        db_order.total_amount = total_amount

        db.add(
            Invoice(
                invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
                order_id=db_order.id,
                customer_id=db_order.customer_id,
                status=InvoiceStatus.ISSUED,
                issue_date=date.today(),
                due_date=date.today() + timedelta(days=14),
                total_amount=total_amount,
                paid_amount=0.0,
            )
        )

        customer.balance += total_amount
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
            .options(joinedload(Invoice.customer), joinedload(Invoice.payments))
            .order_by(Invoice.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

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

        if invoice.customer:
            invoice.customer.balance = max(invoice.customer.balance - payment.amount, 0)

        db.commit()
        db.refresh(db_payment)
        return db_payment


sales_service = SalesService()
