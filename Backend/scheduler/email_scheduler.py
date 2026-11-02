"""
Email Scheduler
---------------
Uses APScheduler to fire the container-ageing report every day at 10:00 AM.
This module is imported inside main.py lifespan so the scheduler starts
automatically when the FastAPI server starts.

Setup:
    pip install apscheduler

.env variables required:
    SMTP_HOST          (default: smtp.gmail.com)
    SMTP_PORT          (default: 587)
    SMTP_USER          sender email address
    SMTP_PASSWORD      sender password or Gmail App Password
    SMTP_USE_TLS       true / false  (default: true)
    REPORT_RECIPIENTS  comma-separated emails  e.g. a@x.com,b@x.com
    REPORT_TIMEZONE    e.g. Asia/Kolkata  (default: Asia/Kolkata)
    REPORT_HOUR        24-hour (default: 10)
    REPORT_MINUTE      (default: 0)
"""

import logging
import os

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from services.email_report_service import send_container_ageing_report

logger = logging.getLogger(__name__)

# ── Schedule config (overrideable from .env) ──────────────────────────────────
TIMEZONE      = os.getenv("REPORT_TIMEZONE", "Asia/Kolkata")
REPORT_HOUR   = int(os.getenv("REPORT_HOUR",   "10"))
REPORT_MINUTE = int(os.getenv("REPORT_MINUTE", "0"))

# Module-level scheduler instance (singleton)
_scheduler: BackgroundScheduler | None = None


def _run_report_job():
    """Wrapper called by APScheduler — logs success / failure."""
    logger.info("Scheduled email job triggered")
    success = send_container_ageing_report()
    if success:
        logger.info("Daily container ageing email sent successfully")
    else:
        logger.error(" Daily container ageing email FAILED — check logs above")


def start_scheduler() -> BackgroundScheduler:
    """
    Starts the background scheduler and registers the daily 10 AM job.
    Safe to call multiple times — returns the existing scheduler if already running.
    """
    global _scheduler

    if _scheduler and _scheduler.running:
        logger.info("Scheduler already running — skipping re-init")
        return _scheduler

    _scheduler = BackgroundScheduler(timezone=TIMEZONE)

    trigger = CronTrigger(
        hour=REPORT_HOUR,
        minute=REPORT_MINUTE,
        timezone=TIMEZONE,
    )

    _scheduler.add_job(
        func=_run_report_job,
        trigger=trigger,
        id="daily_container_ageing_report",
        name="Daily Warehouse Container Ageing Email",
        replace_existing=True,
        misfire_grace_time=300,   # allow up to 5 min late if server was busy
    )

    _scheduler.start()

    logger.info(
        "Email scheduler started — report will fire daily at %02d:%02d (%s)",
        REPORT_HOUR,
        REPORT_MINUTE,
        TIMEZONE,
    )
    return _scheduler


def stop_scheduler():
    """Gracefully shuts down the scheduler (called on app shutdown)."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Email scheduler stopped")
