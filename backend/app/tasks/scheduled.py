"""
Scheduled Celery tasks placeholder — populated in Phase 2+.
"""

from app.tasks.celery_app import celery_app
import logging

logger = logging.getLogger("perp.tasks")


@celery_app.task(name="tasks.health_ping")
def health_ping() -> str:
    """Simple liveness task — verifies Celery worker is responsive."""
    logger.info("Celery health ping OK")
    return "pong"
