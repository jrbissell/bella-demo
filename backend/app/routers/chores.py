from __future__ import annotations

import datetime
import logging
import uuid

from dateutil.rrule import rrulestr
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Chore, FamilyMember
from ..schemas import Chore as ChoreSchema, ChoreCreate, ChoreUpdate

log = logging.getLogger(__name__)
router = APIRouter()


def _next_due(rrule_str: str, current_due: datetime.datetime | None) -> datetime.datetime | None:
    """Return the next occurrence of a recurrence rule after current_due."""
    try:
        base = current_due or datetime.datetime.utcnow()
        rule = rrulestr(f"RRULE:{rrule_str}", dtstart=base, ignoretz=True)
        nxt = rule.after(base)
        return nxt
    except Exception as exc:
        log.warning("Could not compute next recurrence from '%s': %s", rrule_str, exc)
        return None


def _enrich(chore: Chore) -> dict:
    d = ChoreSchema.model_validate(chore).model_dump()
    if chore.family_member:
        d["family_member_name"] = chore.family_member.name
        d["family_member_color"] = chore.family_member.color
    return d


@router.get("/")
def list_chores(db: Session = Depends(get_db)):
    chores = db.query(Chore).join(Chore.family_member).all()
    return [_enrich(c) for c in chores]


@router.post("/", status_code=201)
def create_chore(data: ChoreCreate, db: Session = Depends(get_db)):
    member = db.query(FamilyMember).filter(FamilyMember.id == data.family_member_id).first()
    if not member:
        raise HTTPException(404, "Family member not found")

    chore = Chore(
        uid=str(uuid.uuid4()),
        title=data.title,
        notes=data.notes,
        due_date=data.due_date,
        priority=data.priority,
        recurrence_rule=data.recurrence_rule,
        chore_type=data.chore_type,
        completed=False,
        family_member_id=data.family_member_id,
        last_synced=datetime.datetime.utcnow(),
    )
    db.add(chore)
    db.commit()
    db.refresh(chore)
    return _enrich(chore)


@router.patch("/{chore_id}")
def update_chore(chore_id: int, data: ChoreUpdate, db: Session = Depends(get_db)):
    chore = db.query(Chore).filter(Chore.id == chore_id).first()
    if not chore:
        raise HTTPException(404, "Chore not found")

    updates = data.model_dump(exclude_unset=True)
    completing = updates.get("completed") is True and not chore.completed

    # Recurring chore being completed: roll forward instead of marking done
    if completing and chore.recurrence_rule:
        nxt = _next_due(chore.recurrence_rule, chore.due_date)
        chore.due_date = nxt
        chore.completed = False
        chore.completed_at = None
        db.commit()
        db.refresh(chore)
        return _enrich(chore)

    for field, val in updates.items():
        if field == "completed" and val and not chore.completed:
            chore.completed_at = datetime.datetime.utcnow()
        elif field == "completed" and not val:
            chore.completed_at = None
        setattr(chore, field, val)

    db.commit()
    db.refresh(chore)
    return _enrich(chore)


@router.post("/{chore_id}/split", status_code=201)
def split_chore(chore_id: int, data: ChoreCreate, db: Session = Depends(get_db)):
    """Edit just this occurrence of a recurring chore.

    Advances the original to its next due date and creates a one-time copy
    with the edited values for the current occurrence.
    Returns [updated_original, new_one_time] so the frontend can patch its state.
    """
    chore = db.query(Chore).filter(Chore.id == chore_id).first()
    if not chore:
        raise HTTPException(404, "Chore not found")

    original_due = chore.due_date
    nxt = _next_due(chore.recurrence_rule, chore.due_date)
    chore.due_date = nxt
    db.commit()
    db.refresh(chore)

    one_time = Chore(
        uid=str(uuid.uuid4()),
        title=data.title,
        notes=data.notes,
        due_date=data.due_date if data.due_date else original_due,
        priority=data.priority,
        recurrence_rule=None,
        completed=False,
        family_member_id=data.family_member_id,
        last_synced=datetime.datetime.utcnow(),
    )
    db.add(one_time)
    db.commit()
    db.refresh(one_time)

    return [_enrich(chore), _enrich(one_time)]


@router.delete("/{chore_id}", status_code=204)
def delete_chore(chore_id: int, db: Session = Depends(get_db)):
    chore = db.query(Chore).filter(Chore.id == chore_id).first()
    if not chore:
        raise HTTPException(404, "Chore not found")
    db.delete(chore)
    db.commit()
