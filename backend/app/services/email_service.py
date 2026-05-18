from __future__ import annotations

import smtplib
from datetime import UTC, datetime
from email.message import EmailMessage

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.settings import EmailLog, SystemSettings

DEFAULT_LOGO_URL = "https://farmexa.arosoft.io/brand/farmexa-logo-full.png"
BRAND_TAGLINE = "Manage Smart. Grow Better."


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
    html_body: str | None = None,
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
        if html_body:
            message.add_alternative(html_body, subtype="html")

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


def branded_email_html(
    *,
    title: str,
    intro: str,
    body_html: str,
    action_url: str | None = None,
    action_label: str | None = None,
    system_settings: SystemSettings | None = None,
) -> str:
    system_name = system_settings.system_name if system_settings else "Farmexa"
    logo_url = (system_settings.system_logo_url if system_settings else None) or DEFAULT_LOGO_URL
    if logo_url.startswith("/"):
        logo_url = f"https://farmexa.arosoft.io{logo_url}"
    support_email = (system_settings.support_email if system_settings else None) or "farmexa@arosoft.io"
    action = ""
    if action_url and action_label:
        action = (
            f'<p style="margin:24px 0 0"><a href="{action_url}" '
            'style="display:inline-block;background:#d6a62e;color:#202020;text-decoration:none;'
            'font-weight:700;padding:12px 18px;border-radius:8px"> '
            f"{action_label}</a></p>"
        )
    return f"""
<!doctype html>
<html>
  <body style="margin:0;background:#f7f8fb;font-family:Inter,Segoe UI,Arial,sans-serif;color:#172033">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f8fb;padding:28px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
            <tr>
              <td style="padding:26px 30px 18px;border-bottom:1px solid #eef1f5">
                <img src="{logo_url}" alt="{system_name}" style="height:54px;width:auto;display:block;margin-bottom:14px" />
                <div style="font-size:12px;color:#9a6f0e;font-weight:700;letter-spacing:.04em;text-transform:uppercase">{BRAND_TAGLINE}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 30px 30px">
                <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#202020">{title}</h1>
                <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#475569">{intro}</p>
                <div style="font-size:15px;line-height:1.7;color:#334155">{body_html}</div>
                {action}
              </td>
            </tr>
            <tr>
              <td style="padding:18px 30px;background:#202020;color:#d6dee9;font-size:12px;line-height:1.6">
                {system_name} support: {support_email}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


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
    html_body = branded_email_html(
        title=f"Welcome to {system_name}",
        intro="Your poultry ERP workspace is ready.",
        body_html=(
            f"<p><strong>Farm name:</strong> {farm_name}</p>"
            f"<p><strong>Workspace URL:</strong> <a href=\"{workspace_url}\">{workspace_url}</a></p>"
            "<p><strong>Trial period:</strong> 14 days</p>"
            f"<p><strong>Trial expiry date:</strong> {trial_expiry_date}</p>"
            "<p>You can now sign in and start managing your poultry operations.</p>"
        ),
        action_url=workspace_url,
        action_label="Open workspace",
        system_settings=system_settings,
    )
    return await log_and_send_email(
        db,
        tenant_id=tenant_id,
        recipient=recipient,
        subject=f"Welcome to {system_name} - Your poultry ERP workspace is ready",
        body=body,
        html_body=html_body,
        email_type="Welcome Email",
        system_settings=system_settings,
    )
