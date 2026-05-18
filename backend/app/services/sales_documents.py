from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from io import BytesIO
from typing import Iterable

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from app.models.sales import Invoice
from app.services.pdf_branding import BRAND_DARK, BRAND_PRIMARY, draw_pdf_brand_header

MM_TO_POINTS = 72 / 25.4


@dataclass(frozen=True)
class ReceiptDocument:
    content: bytes
    filename: str
    media_type: str = "application/pdf"


def money(value: float | int | None) -> str:
    return f"UGX {float(value or 0):,.0f}"


def _enum_label(value) -> str:
    raw = getattr(value, "value", value)
    return str(raw or "").replace("_", " ").title()


def _tenant_name(current_user) -> str:
    tenant = getattr(current_user, "tenant", None)
    if tenant is None:
        return "Farmexa Workspace"
    return tenant.business_name or tenant.name or "Farmexa Workspace"


def _tenant_contact_lines(current_user) -> list[str]:
    tenant = getattr(current_user, "tenant", None)
    if tenant is None:
        return []
    return [
        value
        for value in [
            getattr(tenant, "address", None),
            getattr(tenant, "phone", None),
            getattr(tenant, "email", None),
        ]
        if value
    ]


def _invoice_items(invoice: Invoice) -> list[dict[str, object]]:
    order = invoice.order
    if not order:
        return []
    rows = []
    for item in order.items:
        product_name = getattr(getattr(item, "product", None), "name", None) or f"Item #{item.product_id}"
        rows.append(
            {
                "name": product_name,
                "quantity": float(item.quantity or 0),
                "unit_price": float(item.unit_price or 0),
                "subtotal": float(item.subtotal or 0),
            }
        )
    return rows


def _latest_payment(invoice: Invoice):
    payments = sorted(invoice.payments or [], key=lambda payment: payment.created_at, reverse=True)
    return payments[0] if payments else None


def build_thermal_receipt_pdf(invoice: Invoice, current_user, paper: str = "80mm") -> ReceiptDocument:
    width_mm = 58 if paper == "58mm" else 80
    width = width_mm * MM_TO_POINTS
    items = _invoice_items(invoice)
    height = max(420, 330 + (len(items) * 42))
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=(width, height))
    y = height - 18
    margin = 10

    def center(text: str, size: int = 8, bold: bool = False, gap: int = 10):
        nonlocal y
        pdf.setFillColor(colors.HexColor(BRAND_DARK))
        pdf.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        pdf.drawCentredString(width / 2, y, text[:46])
        y -= gap

    def row(left: str, right: str, size: int = 7, bold: bool = False, gap: int = 10):
        nonlocal y
        pdf.setFillColor(colors.HexColor(BRAND_DARK))
        pdf.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        pdf.drawString(margin, y, left[:24])
        pdf.drawRightString(width - margin, y, right[:18])
        y -= gap

    center(_tenant_name(current_user), 9, True, 11)
    for line in _tenant_contact_lines(current_user)[:3]:
        center(str(line), 7, False, 9)
    y -= 3
    pdf.setStrokeColor(colors.HexColor(BRAND_PRIMARY))
    pdf.line(margin, y, width - margin, y)
    y -= 12
    center("SALES RECEIPT", 9, True, 12)
    row("Receipt", f"RCP-{invoice.invoice_number}", 7)
    row("Invoice", invoice.invoice_number, 7)
    row("Date", datetime.now().strftime("%d %b %Y %H:%M"), 7)
    row("Cashier", getattr(current_user, "full_name", None) or getattr(current_user, "email", ""), 7)
    row("Customer", getattr(invoice.customer, "name", "Walk-in"), 7)
    y -= 2
    pdf.setStrokeColor(colors.lightgrey)
    pdf.line(margin, y, width - margin, y)
    y -= 10

    for item in items:
        name = str(item["name"])
        line_total = money(float(item["subtotal"]))
        pdf.setFont("Helvetica-Bold", 7)
        pdf.drawString(margin, y, name[:32])
        y -= 9
        row(f"{item['quantity']:,.2f} x {money(float(item['unit_price']))}", line_total, 7, False, 10)

    y -= 2
    pdf.setStrokeColor(colors.lightgrey)
    pdf.line(margin, y, width - margin, y)
    y -= 12
    row("Subtotal", money(invoice.total_amount), 8)
    row("Paid", money(invoice.paid_amount), 8)
    row("Balance", money(max(float(invoice.total_amount) - float(invoice.paid_amount), 0)), 8)
    row("TOTAL", money(invoice.total_amount), 10, True, 13)
    payment = _latest_payment(invoice)
    if payment:
        row("Payment", _enum_label(payment.payment_method), 7)
        if payment.reference:
            row("Reference", payment.reference, 7)
    y -= 8
    center("Thank you for your business.", 8, False, 11)
    center("Powered by Farmexa", 6, False, 8)
    pdf.showPage()
    pdf.save()
    return ReceiptDocument(buffer.getvalue(), f"{invoice.invoice_number}-{paper}-receipt.pdf")


def _draw_wrapped_lines(pdf: canvas.Canvas, lines: Iterable[str], x: float, y: float, width: int = 84) -> float:
    for line in lines:
        text = str(line)
        while len(text) > width:
            pdf.drawString(x, y, text[:width])
            text = text[width:]
            y -= 12
        pdf.drawString(x, y, text)
        y -= 12
    return y


def build_a4_receipt_pdf(invoice: Invoice, current_user) -> ReceiptDocument:
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = draw_pdf_brand_header(pdf, width, height, "Sales Receipt")
    left = 42
    right = width - 42

    pdf.setFillColor(colors.HexColor(BRAND_DARK))
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawString(left, y, _tenant_name(current_user))
    pdf.setFont("Helvetica", 9)
    y = _draw_wrapped_lines(pdf, _tenant_contact_lines(current_user), left, y - 16)

    info_y = height - 118
    pdf.setFont("Helvetica-Bold", 9)
    for label, value in [
        ("Receipt", f"RCP-{invoice.invoice_number}"),
        ("Invoice", invoice.invoice_number),
        ("Issued", invoice.issue_date.isoformat()),
        ("Due", invoice.due_date.isoformat()),
        ("Status", _enum_label(invoice.status)),
        ("Customer", getattr(invoice.customer, "name", "Walk-in")),
    ]:
        pdf.drawRightString(right - 110, info_y, f"{label}:")
        pdf.setFont("Helvetica", 9)
        pdf.drawRightString(right, info_y, str(value))
        pdf.setFont("Helvetica-Bold", 9)
        info_y -= 14

    y = min(y - 24, info_y - 12)
    pdf.setFillColor(colors.HexColor(BRAND_PRIMARY))
    pdf.rect(left, y - 18, right - left, 20, fill=True, stroke=False)
    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawString(left + 8, y - 12, "Item")
    pdf.drawRightString(right - 170, y - 12, "Qty")
    pdf.drawRightString(right - 85, y - 12, "Unit price")
    pdf.drawRightString(right - 8, y - 12, "Subtotal")
    y -= 30

    pdf.setFillColor(colors.HexColor(BRAND_DARK))
    pdf.setFont("Helvetica", 8)
    for item in _invoice_items(invoice):
        if y < 90:
            pdf.showPage()
            y = draw_pdf_brand_header(pdf, width, height, "Sales Receipt")
        pdf.drawString(left + 8, y, str(item["name"])[:52])
        pdf.drawRightString(right - 170, y, f"{float(item['quantity']):,.2f}")
        pdf.drawRightString(right - 85, y, money(float(item["unit_price"])))
        pdf.drawRightString(right - 8, y, money(float(item["subtotal"])))
        y -= 18

    y -= 12
    pdf.setStrokeColor(colors.lightgrey)
    pdf.line(right - 210, y, right, y)
    y -= 18
    for label, value in [
        ("Subtotal", invoice.total_amount),
        ("Amount paid", invoice.paid_amount),
        ("Balance", max(float(invoice.total_amount) - float(invoice.paid_amount), 0)),
        ("Total", invoice.total_amount),
    ]:
        pdf.setFont("Helvetica-Bold" if label == "Total" else "Helvetica", 10)
        pdf.drawRightString(right - 90, y, label)
        pdf.drawRightString(right, y, money(value))
        y -= 16

    pdf.setFont("Helvetica", 8)
    pdf.setFillColor(colors.grey)
    pdf.drawString(left, 44, "Powered by Farmexa. Manage Smart. Grow Better.")
    pdf.showPage()
    pdf.save()
    return ReceiptDocument(buffer.getvalue(), f"{invoice.invoice_number}-a4-receipt.pdf")
