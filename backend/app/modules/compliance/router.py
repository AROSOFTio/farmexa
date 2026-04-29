from datetime import date

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_permission
from app.modules.compliance.schemas import ComplianceDocumentOut, ComplianceSummaryOut
from app.modules.compliance.service import ComplianceService, document_days_to_expiry

router = APIRouter(prefix="/compliance", tags=["Compliance"])


@router.get("/documents", response_model=list[ComplianceDocumentOut])
async def list_documents(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("farm:read")),
):
    documents = await ComplianceService(db).list_documents(current_user)
    return [
        ComplianceDocumentOut(
            id=document.id,
            title=document.title,
            document_type=document.document_type.value,
            reference_number=document.reference_number,
            issuing_authority=document.issuing_authority,
            issue_date=document.issue_date,
            expiry_date=document.expiry_date,
            renewal_date=document.renewal_date,
            responsible_person=document.responsible_person,
            file_url=document.file_url,
            notes=document.notes,
            status=document.status.value if hasattr(document.status, "value") else str(document.status),
            days_to_expiry=document_days_to_expiry(document),
            created_at=document.created_at,
            updated_at=document.updated_at,
        )
        for document in documents
    ]


@router.get("/summary", response_model=ComplianceSummaryOut)
async def get_summary(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("farm:read")),
):
    return await ComplianceService(db).get_summary(current_user)


@router.post("/documents", response_model=ComplianceDocumentOut, status_code=status.HTTP_201_CREATED)
async def create_document(
    title: str = Form(...),
    document_type: str = Form(...),
    reference_number: str | None = Form(None),
    issuing_authority: str | None = Form(None),
    issue_date: date | None = Form(None),
    expiry_date: date | None = Form(None),
    renewal_date: date | None = Form(None),
    responsible_person: str | None = Form(None),
    notes: str | None = Form(None),
    file: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(require_permission("farm:write")),
):
    document = await ComplianceService(db).create_document(
        current_user,
        title=title,
        document_type=document_type,
        reference_number=reference_number,
        issuing_authority=issuing_authority,
        issue_date=issue_date,
        expiry_date=expiry_date,
        renewal_date=renewal_date,
        responsible_person=responsible_person,
        notes=notes,
        file=file,
    )
    return ComplianceDocumentOut(
        id=document.id,
        title=document.title,
        document_type=document.document_type.value,
        reference_number=document.reference_number,
        issuing_authority=document.issuing_authority,
        issue_date=document.issue_date,
        expiry_date=document.expiry_date,
        renewal_date=document.renewal_date,
        responsible_person=document.responsible_person,
        file_url=document.file_url,
        notes=document.notes,
        status=document.status.value if hasattr(document.status, "value") else str(document.status),
        days_to_expiry=document_days_to_expiry(document),
        created_at=document.created_at,
        updated_at=document.updated_at,
    )
