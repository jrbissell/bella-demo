"""
iCloud CalDAV integration.

iCloud requires an app-specific password (not your Apple ID password).
Generate one at: appleid.apple.com → Sign-In & Security → App-Specific Passwords
"""
from __future__ import annotations

import datetime
import logging
import uuid
from typing import Optional
from zoneinfo import ZoneInfo

import caldav
from icalendar import Calendar, Event, Todo, vDatetime, vDate, vRecur

from ..config import settings

log = logging.getLogger(__name__)

ICLOUD_CALDAV_URL = "https://caldav.icloud.com"


def _get_client(url: str = ICLOUD_CALDAV_URL) -> caldav.DAVClient:
    return caldav.DAVClient(
        url=url,
        username=settings.icloud_username,
        password=settings.icloud_password,
    )


def _get_calendar(calendar_url: str) -> caldav.Calendar:
    """Build a Calendar object directly against its own host, avoiding URL-join issues."""
    client = _get_client(url=calendar_url)
    return caldav.Calendar(client=client, url=calendar_url)


def get_calendars() -> list[dict]:
    """Return all calendars on the iCloud account."""
    client = _get_client()
    principal = client.principal()
    calendars = []
    for cal in principal.calendars():
        calendars.append({
            "name": cal.name,
            "url": str(cal.url),
        })
    return calendars


def find_calendar_by_name(name: str) -> Optional[caldav.Calendar]:
    """Find a CalDAV calendar by display name (case-insensitive)."""
    client = _get_client()
    principal = client.principal()
    for cal in principal.calendars():
        if cal.name and cal.name.lower() == name.lower():
            return cal
    return None


def fetch_events(calendar_url: str) -> list[dict]:
    """Fetch all events from a CalDAV calendar without expansion.

    Recurring events are returned as a single master VEVENT with RRULE intact.
    Exception occurrences (RECURRENCE-ID) are returned as separate entries.
    Uses a wide date window so recurring series starting years ago are included.
    """
    cal = _get_calendar(calendar_url)

    start = datetime.datetime.now(tz=datetime.timezone.utc) - datetime.timedelta(days=365 * 5)
    end   = datetime.datetime.now(tz=datetime.timezone.utc) + datetime.timedelta(days=365 * 5)

    try:
        objects = cal.search(start=start, end=end, event=True, expand=False)
    except Exception as exc:
        log.warning("CalDAV search failed, trying date_search: %s", exc)
        objects = cal.date_search(start=start, end=end, expand=False)

    results = []
    seen_uids: set[str] = set()          # deduplicate master recurring events

    for obj in objects:
        try:
            parsed = _parse_vevent(obj.data)
            if not parsed:
                continue
            uid = parsed["uid"]
            if uid in seen_uids:
                continue
            seen_uids.add(uid)
            parsed["event_url"] = str(obj.url)
            results.append(parsed)
        except Exception as exc:
            log.error("Failed to parse event: %s", exc)

    return results


def create_event(calendar_url: str, event_data: dict) -> str:
    """Create an event on iCloud and return its UID."""
    cal = _get_calendar(calendar_url)

    uid = str(uuid.uuid4())
    ical = _build_ical(uid, event_data)
    cal.add_event(ical)
    return uid


def update_event(calendar_url: str, uid: str, event_data: dict, event_url: str | None = None) -> None:
    """Update an existing event on iCloud.

    Uses the stored CalDAV event_url for a direct PUT when available, avoiding
    a REPORT search which iCloud rejects with 412 in some conditions.
    """
    client = _get_client(url=calendar_url)
    ical_data = _build_ical(uid, event_data)

    try:
        if event_url:
            # Direct PUT to the known URL — no ETag, no REPORT search needed.
            r = client.put(
                event_url,
                ical_data.encode("utf-8"),
                {"Content-Type": 'text/calendar; charset="utf-8"'},
            )
            if r.status not in (200, 201, 204):
                raise Exception(f"PUT to iCloud returned {r.status}")
        else:
            # Fallback: search by UID (may fail on iCloud with 412)
            cal = caldav.Calendar(client=client, url=calendar_url)
            results = cal.search(uid=uid, event=True)
            if not results:
                raise ValueError(f"Event UID {uid} not found on iCloud")
            ev = results[0]
            ev.data = ical_data
            ev.save()
    except Exception as exc:
        log.error("Failed to update event %s: %s", uid, exc)
        raise


def delete_event(calendar_url: str, uid: str) -> None:
    """Delete an event from iCloud."""
    cal = _get_calendar(calendar_url)
    try:
        results = cal.search(uid=uid, event=True)
        if results:
            results[0].delete()
    except Exception as exc:
        log.error("Failed to delete event %s: %s", uid, exc)
        raise


# ── Helpers ──────────────────────────────────────────────────────────────────

def _parse_vevent(ical_data: str) -> Optional[dict]:
    cal = Calendar.from_ical(ical_data)
    for component in cal.walk():
        if component.name != "VEVENT":
            continue

        base_uid = str(component.get("UID", ""))
        summary = str(component.get("SUMMARY", "No Title"))
        dtstart = component.get("DTSTART")
        dtend = component.get("DTEND")
        location = str(component.get("LOCATION", "")) or None
        description = str(component.get("DESCRIPTION", "")) or None
        rrule = component.get("RRULE")
        recurrence_rule = rrule.to_ical().decode() if rrule else None

        # Preserve EXDATE lines so split occurrences survive re-sync
        if recurrence_rule:
            exdates = component.get("EXDATE")
            if exdates:
                if not isinstance(exdates, list):
                    exdates = [exdates]
                dt_strs = []
                for ex in exdates:
                    dts = ex.dts if hasattr(ex, 'dts') else [ex]
                    for d in dts:
                        dt = d.dt if hasattr(d, 'dt') else d
                        if isinstance(dt, datetime.datetime):
                            dt = dt.astimezone(datetime.timezone.utc) if dt.tzinfo else dt.replace(tzinfo=datetime.timezone.utc)
                            dt_strs.append(dt.strftime('%Y%m%dT%H%M%SZ'))
                        elif isinstance(dt, datetime.date):
                            dt_strs.append(dt.strftime('%Y%m%d'))
                if dt_strs:
                    recurrence_rule += '\nEXDATE:' + ','.join(dt_strs)

        # Recurring events expanded with expand=True share the same base UID.
        # Append the recurrence-id (start time) to make each occurrence unique.
        recurrence_id = component.get("RECURRENCE-ID")
        if recurrence_id is not None:
            uid = f"{base_uid}_{recurrence_id.dt}"
        else:
            uid = base_uid

        if dtstart is None:
            return None

        all_day = isinstance(dtstart.dt, datetime.date) and not isinstance(dtstart.dt, datetime.datetime)

        start_dt = dtstart.dt
        end_dt = dtend.dt if dtend else (start_dt + datetime.timedelta(hours=1))

        if all_day:
            start_dt = datetime.datetime(start_dt.year, start_dt.month, start_dt.day, tzinfo=datetime.timezone.utc)
            if isinstance(end_dt, datetime.date) and not isinstance(end_dt, datetime.datetime):
                end_dt = datetime.datetime(end_dt.year, end_dt.month, end_dt.day, tzinfo=datetime.timezone.utc)
        else:
            if start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=datetime.timezone.utc)
            else:
                start_dt = start_dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)

            if end_dt.tzinfo is None:
                end_dt = end_dt.replace(tzinfo=datetime.timezone.utc)
            else:
                end_dt = end_dt.astimezone(datetime.timezone.utc).replace(tzinfo=None)

        return {
            "uid": uid,
            "title": summary,
            "start_time": start_dt.replace(tzinfo=None) if hasattr(start_dt, 'tzinfo') else start_dt,
            "end_time": end_dt.replace(tzinfo=None) if hasattr(end_dt, 'tzinfo') else end_dt,
            "all_day": all_day,
            "location": location,
            "description": description,
            "recurrence_rule": recurrence_rule,
            "raw_ical": ical_data,
        }

    return None


def _build_ical(uid: str, data: dict) -> str:
    cal = Calendar()
    cal.add("prodid", "-//Bella Family Organizer//EN")
    cal.add("version", "2.0")

    ev = Event()
    ev.add("uid", uid)
    ev.add("summary", data["title"])
    ev.add("dtstamp", datetime.datetime.now(tz=datetime.timezone.utc))

    start: datetime.datetime = data["start_time"]
    end: datetime.datetime = data["end_time"]

    if data.get("all_day"):
        ev.add("dtstart", vDate(start.date()))
        ev.add("dtend", vDate(end.date()))
    else:
        ev.add("dtstart", vDatetime(start.replace(tzinfo=datetime.timezone.utc)))
        ev.add("dtend", vDatetime(end.replace(tzinfo=datetime.timezone.utc)))

    if data.get("location"):
        ev.add("location", data["location"])
    if data.get("description"):
        ev.add("description", data["description"])
    if data.get("recurrence_rule"):
        lines = data["recurrence_rule"].split('\n')
        ev.add("rrule", vRecur.from_ical(lines[0]))
        for extra in lines[1:]:
            if ':' not in extra:
                continue
            prop, val = extra.split(':', 1)
            if prop in ('EXDATE', 'EXDATE;VALUE=DATE'):
                dates = []
                for v in val.split(','):
                    v = v.strip()
                    try:
                        if 'T' in v:
                            dt = datetime.datetime.strptime(v.rstrip('Z'), '%Y%m%dT%H%M%S').replace(tzinfo=datetime.timezone.utc)
                        else:
                            d = datetime.datetime.strptime(v, '%Y%m%d').date()
                            dt = datetime.datetime(d.year, d.month, d.day, tzinfo=datetime.timezone.utc)
                        dates.append(dt)
                    except Exception:  # nosec B110
                        pass
                if dates:
                    ev.add('exdate', dates)

    cal.add_component(ev)
    return cal.to_ical().decode()


# ── VTODO (iCloud Reminders) ──────────────────────────────────────────────────

def fetch_chores(reminders_list_url: str) -> list[dict]:
    """Fetch all VTODO items from an iCloud Reminders list."""
    cal = _get_calendar(reminders_list_url)
    try:
        objects = cal.search(todo=True, expand=False)
    except Exception as exc:
        log.warning("VTODO search failed: %s", exc)
        objects = []

    results = []
    seen: set[str] = set()
    for obj in objects:
        try:
            parsed = _parse_vtodo(obj.data)
            if parsed and parsed["uid"] not in seen:
                seen.add(parsed["uid"])
                results.append(parsed)
        except Exception as exc:
            log.error("Failed to parse VTODO: %s", exc)
    return results


def create_chore(reminders_list_url: str, data: dict) -> str:
    """Create a VTODO on iCloud and return its UID."""
    cal = _get_calendar(reminders_list_url)
    uid = str(uuid.uuid4())
    cal.add_todo(_build_vtodo(uid, data))
    return uid


def update_chore(reminders_list_url: str, uid: str, data: dict) -> None:
    """Update an existing VTODO on iCloud."""
    cal = _get_calendar(reminders_list_url)
    try:
        results = cal.search(uid=uid, todo=True)
        if not results:
            raise ValueError(f"Chore UID {uid} not found on iCloud")
        todo = results[0]
        todo.data = _build_vtodo(uid, data)
        todo.save()
    except Exception as exc:
        log.error("Failed to update chore %s: %s", uid, exc)
        raise


def delete_chore(reminders_list_url: str, uid: str) -> None:
    """Delete a VTODO from iCloud."""
    cal = _get_calendar(reminders_list_url)
    try:
        results = cal.search(uid=uid, todo=True)
        if results:
            results[0].delete()
    except Exception as exc:
        log.error("Failed to delete chore %s: %s", uid, exc)
        raise


def _parse_vtodo(ical_data: str) -> Optional[dict]:
    cal = Calendar.from_ical(ical_data)
    for component in cal.walk():
        if component.name != "VTODO":
            continue

        uid = str(component.get("UID", ""))
        title = str(component.get("SUMMARY", "Untitled"))
        notes = str(component.get("DESCRIPTION", "")) or None
        priority = int(str(component.get("PRIORITY", "0")))
        status = str(component.get("STATUS", "NEEDS-ACTION"))
        completed = status.upper() == "COMPLETED"

        due = component.get("DUE")
        due_date = None
        if due:
            d = due.dt
            if isinstance(d, datetime.date) and not isinstance(d, datetime.datetime):
                due_date = datetime.datetime(d.year, d.month, d.day)
            else:
                due_date = d.replace(tzinfo=None) if hasattr(d, "tzinfo") and d.tzinfo else d

        completed_prop = component.get("COMPLETED")
        completed_at = None
        if completed_prop:
            c = completed_prop.dt
            completed_at = c.replace(tzinfo=None) if hasattr(c, "tzinfo") and c.tzinfo else c

        rrule = component.get("RRULE")
        recurrence_rule = rrule.to_ical().decode() if rrule else None

        return {
            "uid": uid,
            "title": title,
            "notes": notes,
            "due_date": due_date,
            "priority": priority,
            "completed": completed,
            "completed_at": completed_at,
            "recurrence_rule": recurrence_rule,
            "raw_ical": ical_data,
        }
    return None


def _build_vtodo(uid: str, data: dict) -> str:
    cal = Calendar()
    cal.add("prodid", "-//Bella Family Organizer//EN")
    cal.add("version", "2.0")

    todo = Todo()
    todo.add("uid", uid)
    todo.add("summary", data["title"])
    todo.add("dtstamp", datetime.datetime.now(tz=datetime.timezone.utc))

    if data.get("notes"):
        todo.add("description", data["notes"])

    if data.get("due_date"):
        due = data["due_date"]
        if not hasattr(due, "tzinfo") or due.tzinfo is None:
            due = due.replace(tzinfo=datetime.timezone.utc)
        todo.add("due", vDatetime(due))

    priority = data.get("priority", 0)
    if priority:
        todo.add("priority", priority)

    if data.get("recurrence_rule"):
        todo.add("rrule", vRecur.from_ical(data["recurrence_rule"]))

    if data.get("completed"):
        todo.add("status", "COMPLETED")
        todo.add("percent-complete", 100)
        completed_at = data.get("completed_at") or datetime.datetime.utcnow()
        if not hasattr(completed_at, "tzinfo") or completed_at.tzinfo is None:
            completed_at = completed_at.replace(tzinfo=datetime.timezone.utc)
        todo.add("completed", vDatetime(completed_at))
    else:
        todo.add("status", "NEEDS-ACTION")

    cal.add_component(todo)
    return cal.to_ical().decode()
