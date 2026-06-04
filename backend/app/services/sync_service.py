"""
Background sync: pulls iCloud events into SQLite for fast display.
Runs on a schedule (default every 5 minutes) and can be triggered manually.
"""
from __future__ import annotations

import datetime
import logging

from sqlalchemy.orm import Session

from ..config import settings
from ..database import SessionLocal
from ..models import CalendarEvent, FamilyMember
from . import caldav_service

log = logging.getLogger(__name__)


def sync_all_calendars() -> dict:
    """Sync all family members' iCloud calendars into SQLite. Safe to call repeatedly."""
    if not settings.icloud_username or not settings.icloud_password:
        log.warning("iCloud credentials not configured — skipping sync")
        return {"status": "skipped", "message": "iCloud credentials not set", "synced_count": 0, "errors": []}

    db = SessionLocal()
    errors = []
    total = 0

    try:
        members = db.query(FamilyMember).all()
        for member in members:
            try:
                count = _sync_member(db, member)
                total += count
            except Exception as exc:
                msg = f"{member.name}: {exc}"
                log.error("Sync failed for %s: %s", member.name, exc)
                errors.append(msg)
    finally:
        db.close()

    return {
        "status": "ok" if not errors else "partial",
        "message": f"Synced {total} events",
        "synced_count": total,
        "errors": errors,
    }


def _sync_member(db: Session, member: FamilyMember) -> int:
    """Resolve the member's CalDAV URL if needed, then replace all their events."""
    if not member.calendar_url:
        cal = caldav_service.find_calendar_by_name(member.icloud_calendar_name)
        if cal is None:
            raise ValueError(f"Calendar '{member.icloud_calendar_name}' not found on iCloud")
        member.calendar_url = str(cal.url)
        db.commit()

    incoming = caldav_service.fetch_events(member.calendar_url)
    incoming_uids = {ev["uid"] for ev in incoming}

    existing = db.query(CalendarEvent).filter(CalendarEvent.family_member_id == member.id).all()
    for ev in existing:
        if ev.uid not in incoming_uids:
            db.delete(ev)
    db.commit()

    count = 0
    for ev_data in incoming:
        try:
            _upsert_event(db, ev_data, member.id)
            db.commit()
            count += 1
        except Exception as exc:
            db.rollback()
            log.warning("Skipping event uid=%s: %s", ev_data.get("uid"), exc)

    return count


def _upsert_event(db: Session, ev_data: dict, family_member_id: int) -> None:
    uid = ev_data["uid"]
    existing = db.query(CalendarEvent).filter(CalendarEvent.uid == uid).first()

    fields = dict(
        title=ev_data["title"],
        start_time=ev_data["start_time"],
        end_time=ev_data["end_time"],
        all_day=ev_data["all_day"],
        location=ev_data.get("location"),
        description=ev_data.get("description"),
        recurrence_rule=ev_data.get("recurrence_rule"),
        event_url=ev_data.get("event_url"),
        raw_ical=ev_data.get("raw_ical"),
        last_synced=datetime.datetime.utcnow(),
        family_member_id=family_member_id,
    )

    if existing:
        for k, v in fields.items():
            setattr(existing, k, v)
    else:
        db.add(CalendarEvent(uid=uid, **fields))
