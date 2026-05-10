from __future__ import annotations

import smtplib
from datetime import UTC, datetime
from email.message import EmailMessage

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.settings import EmailLog, SystemSettings


def _sender(system_settings: SystemSettings | None = None) -> str:
    sender_name = (system_settings.sender_name if system_settings else settings.SMTP_FROM_NAME) or "Farmexa"
    sender_email = (
        system_settings.sender_email
        if system_settings and system_settings.sender_email
        else settings.SMTP_FROM_EMAIL
        or settings.SMTP_USERNAME
        or "farmexa@arosoft.io"
    )
    return f"{sender_name} <{sender_email}>"


async def log_and_send_email(
    db: AsyncSession,
    *,
    recipient: str,
    subject: str,
    body: str,
    email_type: str,
    tenant_id: int | None = None,
    system_settings: SystemSettings | None = None,
) -> EmailLog:
    log = EmailLog(
        tenant_id=tenant_id,
        recipient=recipient,
        sender=_sender(system_settings),
        email_type=email_type,
        subject=subject,
        body_preview=body[:500],
        status="pending",
    )
    db.add(log)
    await db.flush()

    smtp_host = (system_settings.smtp_host if system_settings else None) or settings.SMTP_HOST
    smtp_port = (system_settings.smtp_port if system_settings else None) or settings.SMTP_PORT
    smtp_username = (system_settings.smtp_username if system_settings else None) or settings.SMTP_USERNAME
    smtp_password = (system_settings.smtp_password if system_settings else None) or settings.SMTP_PASSWORD
    use_tls = (system_settings.smtp_use_tls if system_settings else None)
    if use_tls is None:
        use_tls = settings.SMTP_USE_TLS

    if not smtp_host:
        log.status = "skipped"
        log.error_message = "SMTP_HOST is not configured."
        return log

    try:
        message = EmailMessage()
        message["From"] = log.sender
        message["To"] = recipient
        message["Subject"] = subject
        message.set_content(body)

        with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as server:
            if use_tls:
                server.starttls()
            if smtp_username and smtp_password:
                server.login(smtp_username, smtp_password)
            server.send_message(message)

        log.status = "sent"
        log.sent_at = datetime.now(UTC)
    except Exception as exc:  # pragma: no cover - depends on external SMTP
        log.status = "failed"
        log.error_message = str(exc)
    return log


async def send_welcome_email(
    db: AsyncSession,
    *,
    tenant_id: int,
    farm_name: str,
    contact_name: str | None,
    recipient: str,
    workspace_url: str,
    trial_expiry_date,
    system_settings: SystemSettings | None = None,
) -> EmailLog:
    system_name = system_settings.system_name if system_settings else "Farmexa"
    support_email = system_settings.support_email if system_settings else "farmexa@arosoft.io"
    name = contact_name or farm_name
    body = (
        f"Hello {name},\n\n"
        f"Your {system_name} workspace has been created successfully.\n\n"
        f"Farm Name: {farm_name}\n"
        f"Workspace URL: {workspace_url}\n"
        "Trial Period: 14 days\n"
        f"Trial Expiry Date: {trial_expiry_date}\n\n"
        "You can now sign in and start managing your poultry operations.\n\n"
        f"Regards,\n{system_name} Team\n{support_email}\n"
    )
    return await log_and_send_email(
        db,
        tenant_id=tenant_id,
        recipient=recipient,
        subject=f"Welcome to {system_name} - Your poultry ERP workspace is ready",
        body=body,
        email_type="Welcome Email",
        system_settings=system_settings,
    )
