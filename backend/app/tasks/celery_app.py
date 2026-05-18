"""
Celery application configuration.
"""

from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "farmexa",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.tasks.scheduled"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "process-compliance-reminders-daily": {
            "task": "tasks.process_compliance_reminders",
            "schedule": crontab(hour=6, minute=0),
        },
        "process-trial-day-7-warnings": {
            "task": "tasks.process_trial_day_7_warnings",
            "schedule": crontab(hour=7, minute=0),
        },
        "process-trial-day-13-warnings": {
            "task": "tasks.process_trial_day_13_warnings",
            "schedule": crontab(hour=7, minute=10),
        },
        "process-expired-trials": {
            "task": "tasks.process_expired_trials",
            "schedule": crontab(hour=7, minute=20),
        },
        "process-subscription-status-updates": {
            "task": "tasks.process_subscription_status_updates",
            "schedule": crontab(hour=7, minute=30),
        },
        "process-email-retries": {
            "task": "tasks.process_email_retries",
            "schedule": crontab(minute="*/30"),
        },
        "process-customer-balance-reminders": {
            "task": "tasks.process_customer_balance_reminders",
            "schedule": crontab(hour=6, minute=30),
        },
    },
)
