"""
Scheduled Celery tasks for Farmexa background operations.
"""

import logging

from app.tasks.celery_app import celery_app

logger = logging.getLogger("farmexa.tasks")


@celery_app.task(name="tasks.health_ping")
def health_ping() -> str:
    """Simple liveness task that verifies the Celery worker is responsive."""
    logger.info("Celery health ping OK")
    return "pong"
