from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger("farmexa.pdf_branding")

BRAND_LOGO_FULL_PATH = Path(__file__).resolve().parents[1] / "assets" / "brand" / "farmexa-logo-full.png"
BRAND_PRIMARY = "#d6a62e"
BRAND_DARK = "#0b1018"


def draw_pdf_brand_header(canvas, page_width: float, page_height: float, title: str | None = None) -> float:
    """Draw a reusable Farmexa report header and return the next y-position.

    This helper is intentionally defensive so future PDF exports do not fail when
    the logo file is unavailable in a deployment image.
    """
    top = page_height - 42
    try:
        if BRAND_LOGO_FULL_PATH.exists():
            canvas.drawImage(str(BRAND_LOGO_FULL_PATH), 42, top - 34, width=132, height=50, preserveAspectRatio=True, mask="auto")
        else:
            logger.warning("Farmexa PDF logo missing at %s", BRAND_LOGO_FULL_PATH)
            canvas.setFillColor(BRAND_DARK)
            canvas.setFont("Helvetica-Bold", 15)
            canvas.drawString(42, top - 16, "Farmexa")
    except Exception as exc:  # pragma: no cover - depends on reportlab runtime image support
        logger.warning("Could not draw Farmexa PDF logo: %s", exc)
        canvas.setFillColor(BRAND_DARK)
        canvas.setFont("Helvetica-Bold", 15)
        canvas.drawString(42, top - 16, "Farmexa")

    if title:
        canvas.setFillColor(BRAND_DARK)
        canvas.setFont("Helvetica-Bold", 14)
        canvas.drawRightString(page_width - 42, top - 12, title)

    canvas.setStrokeColor(BRAND_PRIMARY)
    canvas.setLineWidth(1)
    canvas.line(42, top - 50, page_width - 42, top - 50)
    return top - 72
