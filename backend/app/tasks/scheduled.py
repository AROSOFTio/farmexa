"""
Scheduled Celery tasks for Farmexa background operations.
"""

import asyncio
import logging

from app.db.session import AsyncSessionLocal
from app.modules.compliance.service import process_due_document_reminders
from app.tasks.celery_app import celery_app

logger = logging.getLogger("farmexa.tasks")


@celery_app.task(name="tasks.health_ping")
def health_ping() -> str:
    """Simple liveness task that verifies the Celery worker is responsive."""
    logger.info("Celery health ping OK")
    return "pong"


@celery_app.task(name="tasks.process_compliance_reminders")
def process_compliance_reminders_task() -> int:
    """Send due compliance expiry reminders and mark them as delivered."""
    return asyncio.run(_process_compliance_reminders_async())


async def _process_compliance_reminders_async() -> int:
    async with AsyncSessionLocal() as db:
        processed = await process_due_document_reminders(db)
        logger.info("Processed %s compliance reminder(s).", processed)
        return processed
