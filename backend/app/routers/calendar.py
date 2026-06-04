from __future__ import annotations

import datetime
import uuid
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import CalendarEvent, FamilyMember
from ..schemas import CalendarEvent as CalendarEventSchema, EventCreate, EventUpdate, EventSplitRequest
from ..services import caldav_service
from ..services.sync_service import sync_all_calendars
from ..config import settings

router = APIRouter()
log = logging.getLogger(__name__)


@router.get("/", response_model=list[CalendarEventSchema])
def list_events(
    start: datetime.datetime = Query(default=None),
    end: datetime.datetime = Query(default=None),
    member_id: int = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(CalendarEvent).options(joinedload(CalendarEvent.family_member))

    if start:
        query = query.filter(CalendarEvent.end_time >= start)
    if end:
        query = query.filter(CalendarEvent.start_time <= end)
    if member_id:
        query = query.filter(CalendarEvent.family_member_id == member_id)

    events = query.all()
    result = []
    for ev in events:
        schema = CalendarEventSchema.model_validate(ev)
        if ev.family_member:
            schema.family_member_name = ev.family_member.name
            schema.family_member_color = ev.family_member.color
        result.append(schema)
    return result


@router.post("/", response_model=CalendarEventSchema, status_code=201)
def create_event(payload: EventCreate, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    member = db.query(FamilyMember).filter(FamilyMember.id == payload.family_member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Family member not found")

    uid = str(uuid.uuid4())

    # Write to iCloud if configured
    if settings.icloud_username and member.calendar_url:
        try:
            uid = caldav_service.create_event(member.calendar_url, payload.model_dump())
        except Exception as exc:
            log.error("iCloud write failed: %s", exc)

    event = CalendarEvent(
        uid=uid,
        family_member_id=payload.family_member_id,
        title=payload.title,
        start_time=payload.start_time,
        end_time=payload.end_time,
        all_day=payload.all_day,
        location=payload.location,
        description=payload.description,
        recurrence_rule=payload.recurrence_rule,
        last_synced=datetime.datetime.utcnow(),
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    # For recurring events pushed to iCloud, sync in the background so all
    # occurrences appear on the calendar within seconds.
    if payload.recurrence_rule and settings.icloud_username:
        background_tasks.add_task(sync_all_calendars)

    schema = CalendarEventSchema.model_validate(event)
    schema.family_member_name = member.name
    schema.family_member_color = member.color
    return schema


@router.patch("/{event_id}", response_model=CalendarEventSchema)
def update_event(event_id: int, payload: EventUpdate, db: Session = Depends(get_db)):
    event = db.query(CalendarEvent).options(joinedload(CalendarEvent.family_member)).filter(
        CalendarEvent.id == event_id
    ).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(event, field, value)

    member = event.family_member
    if "family_member_id" in updates:
        member = db.query(FamilyMember).filter(FamilyMember.id == updates["family_member_id"]).first()

    # Write to iCloud if configured
    if settings.icloud_username and member and member.calendar_url:
        try:
            caldav_service.update_event(member.calendar_url, event.uid, {
                "title": event.title,
                "start_time": event.start_time,
                "end_time": event.end_time,
                "all_day": event.all_day,
                "location": event.location,
                "description": event.description,
                "recurrence_rule": event.recurrence_rule,
            }, event_url=event.event_url)
        except Exception as exc:
            log.error("iCloud update failed: %s", exc)

    db.commit()
    db.refresh(event)

    schema = CalendarEventSchema.model_validate(event)
    if member:
        schema.family_member_name = member.name
        schema.family_member_color = member.color
    return schema


@router.post("/{event_id}/split", status_code=201)
def split_event(event_id: int, payload: EventSplitRequest, db: Session = Depends(get_db)):
    """Edit just this occurrence of a recurring event.

    Adds an EXDATE to the master (skipping this occurrence) and creates a
    one-time copy with the edited values. Returns [updated_master, new_one_time].
    """
    event = db.query(CalendarEvent).options(joinedload(CalendarEvent.family_member)).filter(
        CalendarEvent.id == event_id
    ).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Build EXDATE value for this occurrence
    occ = payload.occurrence_date
    if event.all_day:
        exdate_val = occ.strftime('%Y%m%d')
    else:
        occ_utc = occ.replace(tzinfo=datetime.timezone.utc) if not occ.tzinfo else occ.astimezone(datetime.timezone.utc)
        exdate_val = occ_utc.strftime('%Y%m%dT%H%M%SZ')

    # Append EXDATE to the master's recurrence_rule field
    existing = event.recurrence_rule or ''
    lines = existing.split('\n')
    base_rrule = lines[0]
    existing_exdates = [l for l in lines[1:] if l.startswith('EXDATE')]
    other_lines  = [l for l in lines[1:] if not l.startswith('EXDATE')]

    all_vals = []
    for ex_line in existing_exdates:
        _, vals = ex_line.split(':', 1)
        all_vals.extend(v.strip() for v in vals.split(',') if v.strip())
    all_vals.append(exdate_val)

    new_rrule = '\n'.join(filter(None, [base_rrule] + other_lines + ['EXDATE:' + ','.join(all_vals)]))
    event.recurrence_rule = new_rrule

    member = event.family_member
    if settings.icloud_username and member and member.calendar_url:
        try:
            caldav_service.update_event(member.calendar_url, event.uid, {
                "title": event.title,
                "start_time": event.start_time,
                "end_time": event.end_time,
                "all_day": event.all_day,
                "location": event.location,
                "description": event.description,
                "recurrence_rule": new_rrule,
            }, event_url=event.event_url)
        except Exception as exc:
            log.error("iCloud update (split master) failed: %s", exc)

    db.commit()
    db.refresh(event)

    # Create one-time copy with the edited values
    new_uid = str(uuid.uuid4())
    one_time_data = payload.model_dump()
    one_time_data.pop('occurrence_date', None)

    if settings.icloud_username and member and member.calendar_url:
        try:
            new_uid = caldav_service.create_event(member.calendar_url, one_time_data)
        except Exception as exc:
            log.error("iCloud create (split copy) failed: %s", exc)

    one_time = CalendarEvent(
        uid=new_uid,
        family_member_id=payload.family_member_id,
        title=payload.title,
        start_time=payload.start_time,
        end_time=payload.end_time,
        all_day=payload.all_day,
        location=payload.location,
        description=payload.description,
        recurrence_rule=None,
        last_synced=datetime.datetime.utcnow(),
    )
    db.add(one_time)
    db.commit()
    db.refresh(one_time)

    master_schema = CalendarEventSchema.model_validate(event)
    if member:
        master_schema.family_member_name = member.name
        master_schema.family_member_color = member.color

    one_time_schema = CalendarEventSchema.model_validate(one_time)
    one_time_schema.family_member_name = member.name if member else None
    one_time_schema.family_member_color = member.color if member else None

    return [master_schema, one_time_schema]


@router.delete("/{event_id}", status_code=204)
def delete_event(event_id: int, db: Session = Depends(get_db)):
    event = db.query(CalendarEvent).options(joinedload(CalendarEvent.family_member)).filter(
        CalendarEvent.id == event_id
    ).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    member = event.family_member
    if settings.icloud_username and member and member.calendar_url:
        try:
            caldav_service.delete_event(member.calendar_url, event.uid)
        except Exception as exc:
            log.error("iCloud delete failed: %s", exc)

    db.delete(event)
    db.commit()
