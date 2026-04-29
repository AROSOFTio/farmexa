from __future__ import annotations

import smtplib
from datetime import UTC, date, datetime, timedelta
from email.message import EmailMessage
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.compliance import (
    ComplianceDocument,
    ComplianceDocumentStatus,
    ComplianceDocumentType,
    DocumentReminder,
    ReminderStatus,
)
from app.models.user import User
from app.modules.users.catalog import COMPLIANCE_NOTIFICATION_ROLES
from app.modules.compliance.schemas import ComplianceAlertOut


REMINDER_OFFSETS = (30, 15, 7)


class ComplianceService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _get_tenant_id(self, user: User) -> int:
        if not user.tenant_id:
            raise HTTPException(status_code=403, detail="Your account is not assigned to a tenant.")
        return int(user.tenant_id)

    @staticmethod
    def _coerce_document_type(value: str) -> ComplianceDocumentType:
        try:
            return ComplianceDocumentType(value)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="Invalid document type.") from exc

    @staticmethod
    def _status_for(expiry_date: date | None) -> ComplianceDocumentStatus:
        if expiry_date is None:
            return ComplianceDocumentStatus.ACTIVE
        today = date.today()
        if expiry_date < today:
            return ComplianceDocumentStatus.EXPIRED
        if expiry_date <= today + timedelta(days=30):
            return ComplianceDocumentStatus.EXPIRING_SOON
        return ComplianceDocumentStatus.ACTIVE

    @staticmethod
    def _days_to_expiry(expiry_date: date | None) -> int | None:
        if expiry_date is None:
            return None
        return (expiry_date - date.today()).days

    async def _save_upload(self, tenant_id: int, file: UploadFile | None) -> str | None:
        if file is None or not file.filename:
            return None

        upload_dir = Path(settings.UPLOAD_DIR) / "compliance" / str(tenant_id)
        upload_dir.mkdir(parents=True, exist_ok=True)
        extension = Path(file.filename).suffix
        target_name = f"{uuid4().hex}{extension}"
        target_path = upload_dir / target_name

        contents = await file.read()
        target_path.write_bytes(contents)
        return f"/uploads/compliance/{tenant_id}/{target_name}"

    async def _sync_reminders(self, document: ComplianceDocument) -> None:
        await self.db.execute(
            delete(DocumentReminder).where(
                DocumentReminder.document_id == document.id,
                DocumentReminder.status == ReminderStatus.PENDING,
            )
        )

        scheduled_dates: set[tuple[str, date]] = set()
        if document.reminder_date is not None:
            scheduled_dates.add(("custom_date", document.reminder_date))
        if document.expiry_date is not None:
            for offset in REMINDER_OFFSETS:
                scheduled_dates.add((f"{offset}_day", document.expiry_date - timedelta(days=offset)))

        for reminder_type, scheduled_for in sorted(scheduled_dates, key=lambda item: item[1]):
            self.db.add(
                DocumentReminder(
                    tenant_id=document.tenant_id,
                    document_id=document.id,
                    reminder_type=reminder_type,
                    scheduled_for=scheduled_for,
                    status=ReminderStatus.PENDING,
                )
            )

    async def list_documents(self, user: User) -> list[ComplianceDocument]:
        tenant_id = self._get_tenant_id(user)
        result = await self.db.execute(
            select(ComplianceDocument)
            .where(ComplianceDocument.tenant_id == tenant_id)
            .options(selectinload(ComplianceDocument.reminders))
            .order_by(ComplianceDocument.expiry_date.is_(None), ComplianceDocument.expiry_date.asc(), ComplianceDocument.created_at.desc())
        )
        documents = list(result.scalars().all())
        for document in documents:
            document.status = self._status_for(document.expiry_date)
        await self.db.commit()
        return documents

    async def create_document(
        self,
        user: User,
        *,
        title: str,
        document_type: str,
        reference_number: str | None,
        issuing_authority: str | None,
        issue_date: date | None,
        expiry_date: date | None,
        reminder_date: date | None,
        renewal_date: date | None,
        responsible_person: str | None,
        notes: str | None,
        file: UploadFile | None,
    ) -> ComplianceDocument:
        tenant_id = self._get_tenant_id(user)
        file_url = await self._save_upload(tenant_id, file)

        document = ComplianceDocument(
          tenant_id=tenant_id,
          title=title.strip(),
          document_type=self._coerce_document_type(document_type),
          reference_number=reference_number or None,
          issuing_authority=issuing_authority or None,
          issue_date=issue_date,
          expiry_date=expiry_date,
          reminder_date=reminder_date,
          renewal_date=renewal_date,
          responsible_person=responsible_person or None,
          file_url=file_url,
          notes=notes or None,
          status=self._status_for(expiry_date),
        )
        self.db.add(document)
        await self.db.flush()
        await self._sync_reminders(document)
        await self.db.commit()
        await self.db.refresh(document)
        return document

    async def get_summary(self, user: User) -> dict:
        documents = await self.list_documents(user)
        alerts: list[ComplianceAlertOut] = []
        for document in documents:
            days_to_expiry = self._days_to_expiry(document.expiry_date)
            if document.status in {ComplianceDocumentStatus.EXPIRED, ComplianceDocumentStatus.EXPIRING_SOON}:
                reminder_offsets = [
                    int(reminder.reminder_type.split("_")[0])
                    for reminder in document.reminders
                    if reminder.reminder_type.endswith("_day") and reminder.reminder_type.split("_")[0].isdigit()
                ]
                alerts.append(
                    ComplianceAlertOut(
                        document_id=document.id,
                        title=document.title,
                        document_type=document.document_type.value,
                        expiry_date=document.expiry_date,
                        status=document.status.value,
                        days_to_expiry=days_to_expiry,
                        reminder_offsets=sorted(reminder_offsets, reverse=True),
                    )
                )

        return {
            "total_documents": len(documents),
            "active_documents": sum(1 for doc in documents if doc.status == ComplianceDocumentStatus.ACTIVE),
            "expiring_documents": sum(1 for doc in documents if doc.status == ComplianceDocumentStatus.EXPIRING_SOON),
            "expired_documents": sum(1 for doc in documents if doc.status == ComplianceDocumentStatus.EXPIRED),
            "alerts": alerts,
        }


async def process_due_document_reminders(db: AsyncSession) -> int:
    today = date.today()
    result = await db.execute(
        select(DocumentReminder)
        .where(
            DocumentReminder.status == ReminderStatus.PENDING,
            DocumentReminder.scheduled_for <= today,
        )
        .options(
            selectinload(DocumentReminder.document).selectinload(ComplianceDocument.tenant),
        )
    )
    reminders = list(result.scalars().all())

    for reminder in reminders:
        await _send_reminder_email(db, reminder)
        reminder.status = ReminderStatus.SENT
        reminder.sent_at = datetime.now(UTC)

    await db.commit()
    return len(reminders)


def document_days_to_expiry(document: ComplianceDocument) -> int | None:
    return ComplianceService._days_to_expiry(document.expiry_date)


async def _send_reminder_email(db: AsyncSession, reminder: DocumentReminder) -> None:
    document = reminder.document
    tenant = document.tenant
    if tenant is None:
        return

    recipients = set()
    if tenant.email:
        recipients.add(tenant.email)

    users_result = await db.execute(
        select(User)
        .where(
            User.tenant_id == tenant.id,
            User.is_active.is_(True),
        )
        .options(selectinload(User.role))
    )
    for user in users_result.scalars().all():
        role_name = user.role.name if user.role else ""
        if role_name in COMPLIANCE_NOTIFICATION_ROLES and user.email:
            recipients.add(user.email)

    if not recipients:
        return

    subject = f"Compliance document expiring: {document.title}"
    expiry_text = document.expiry_date.isoformat() if document.expiry_date else "No expiry date"
    body = (
        f"Document: {document.title}\n"
        f"Type: {document.document_type.value}\n"
        f"Expiry date: {expiry_text}\n"
        f"Reminder: {reminder.reminder_type.replace('_', ' ')}\n"
        f"Responsible person: {document.responsible_person or 'Not set'}\n"
        f"Reference number: {document.reference_number or 'Not set'}\n"
        f"Please renew or replace this document before it expires."
    )
    _deliver_email(subject, body, sorted(recipients))


def _deliver_email(subject: str, body: str, recipients: list[str]) -> None:
    if not settings.SMTP_HOST or not settings.SMTP_FROM_EMAIL:
        return

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = ", ".join(recipients)
    message.set_content(body)

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as server:
        if settings.SMTP_USE_TLS:
            server.starttls()
        if settings.SMTP_USERNAME and settings.SMTP_PASSWORD:
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.send_message(message)
