from sqlalchemy.orm import Session
from fastapi import HTTPException
import uuid
from app.models.sales import Customer, Order, OrderItem, Invoice, Payment, OrderStatus, InvoiceStatus
from app.models.inventory import StockItem, StockMovement, MovementType
from . import schemas

class SalesService:
    def get_customers(self, db: Session, skip: int = 0, limit: int = 100):
        return db.query(Customer).offset(skip).limit(limit).all()

    def get_orders(self, db: Session, skip: int = 0, limit: int = 100):
        return db.query(Order).order_by(Order.created_at.desc()).offset(skip).limit(limit).all()

    def create_customer(self, db: Session, customer: schemas.CustomerCreate):
        db_cust = Customer(**customer.model_dump())
        db.add(db_cust)
        db.commit()
        db.refresh(db_cust)
        return db_cust

    def create_order(self, db: Session, order: schemas.OrderCreate):
        # Calculate total
        total = sum(i.quantity * i.unit_price for i in order.items)
        
        db_order = Order(
            customer_id=order.customer_id,
            status=order.status,
            notes=order.notes,
            total_amount=total
        )
        db.add(db_order)
        db.flush()

        for item in order.items:
            # Check stock
            stock = db.query(StockItem).filter(StockItem.id == item.product_id).first()
            if not stock or stock.current_quantity < item.quantity:
                raise HTTPException(status_code=400, detail=f"Insufficient stock for product {item.product_id}")
            
            db_item = OrderItem(
                order_id=db_order.id,
                product_id=item.product_id,
                quantity=item.quantity,
                unit_price=item.unit_price,
                subtotal=item.quantity * item.unit_price
            )
            db.add(db_item)
            
            # Reduce inventory
            prev_qty = stock.current_quantity
            new_qty = prev_qty - item.quantity
            stock.current_quantity = new_qty
            
            mov = StockMovement(
                item_id=stock.id,
                movement_type=MovementType.OUT,
                quantity=item.quantity,
                previous_quantity=prev_qty,
                new_quantity=new_qty,
                reference_type="sale_order",
                reference_id=db_order.id,
                unit_cost=stock.average_cost,
                notes=f"Order {db_order.id}"
            )
            db.add(mov)

        # Create Invoice automatically
        inv_number = f"INV-{uuid.uuid4().hex[:6].upper()}"
        from datetime import date, timedelta
        
        db_inv = Invoice(
            invoice_number=inv_number,
            order_id=db_order.id,
            customer_id=db_order.customer_id,
            status=InvoiceStatus.ISSUED,
            issue_date=date.today(),
            due_date=date.today() + timedelta(days=14),
            total_amount=total
        )
        db.add(db_inv)

        # Update customer balance
        cust = db.query(Customer).filter(Customer.id == order.customer_id).first()
        cust.balance += total

        db.commit()
        db.refresh(db_order)
        return db_order

    def get_invoices(self, db: Session, skip: int = 0, limit: int = 100):
        return db.query(Invoice).offset(skip).limit(limit).all()

    def add_payment(self, db: Session, invoice_id: int, payment: schemas.PaymentCreate):
        inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not inv:
            raise HTTPException(status_code=404, detail="Invoice not found")
        
        db_pay = Payment(
            invoice_id=invoice_id,
            amount=payment.amount,
            payment_method=payment.payment_method,
            payment_date=payment.payment_date,
            reference=payment.reference
        )
        db.add(db_pay)

        inv.paid_amount += payment.amount
        if inv.paid_amount >= inv.total_amount:
            inv.status = InvoiceStatus.PAID
        elif inv.paid_amount > 0:
            inv.status = InvoiceStatus.PARTIAL

        # Decrease customer balance
        cust = db.query(Customer).filter(Customer.id == inv.customer_id).first()
        if cust:
            cust.balance -= payment.amount

        db.commit()
        db.refresh(db_pay)
        return db_pay

sales_service = SalesService()
