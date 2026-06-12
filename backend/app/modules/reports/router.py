from __future__ import annotations

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.deps import require_permission
from app.db.tenant_db import get_tenant_sync_db
from app.modules.reports import schemas
from app.modules.reports.service import reports_service
from app.core.limiter import limiter

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/catalog", response_model=list[schemas.ReportCatalogItem])
def report_catalog(current_user=Depends(require_permission("reports:read"))):
    return reports_service.catalog()


@router.post("/{report_key}/preview", response_model=schemas.ReportPreview)
def report_preview(
    report_key: str,
    payload: schemas.ReportRequest,
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("reports:read")),
):
    return reports_service.preview(db, report_key, payload)


@router.post("/{report_key}/export")
@limiter.limit("20/minute")
def report_export(
    report_key: str,
    payload: schemas.ReportRequest,
    request: Request,
    format: schemas.ReportFormat = Query("pdf"),
    db: Session = Depends(get_tenant_sync_db),
    current_user=Depends(require_permission("reports:export")),
):
    content, filename, media_type = reports_service.export(db, report_key, payload, format)
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
