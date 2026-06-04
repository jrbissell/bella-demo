from __future__ import annotations
import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Routine, RoutineItem, RoutineCompletion

router = APIRouter()

# ── schemas ───────────────────────────────────────────────────────────────────

class RoutineCreate(BaseModel):
    name:             str
    routine_type:     str               # morning | evening | daily
    schedule:         str          = 'daily'  # daily | weekdays | weekends
    family_member_id: Optional[int] = None
    enabled:          bool          = True

class RoutineUpdate(BaseModel):
    name:             Optional[str]  = None
    routine_type:     Optional[str]  = None
    schedule:         Optional[str]  = None
    family_member_id: Optional[int]  = None
    enabled:          Optional[bool] = None
    sort_order:       Optional[int]  = None

class ItemCreate(BaseModel):
    title:    str
    schedule: str = 'daily'   # daily | weekdays | weekends

class ItemUpdate(BaseModel):
    title:      Optional[str] = None
    schedule:   Optional[str] = None
    sort_order: Optional[int] = None

class CompletionCreate(BaseModel):
    routine_item_id: int
    date:            str   # YYYY-MM-DD

# ── helpers ───────────────────────────────────────────────────────────────────

def _out(routine: Routine, done: dict) -> dict:
    return {
        "id":               routine.id,
        "name":             routine.name,
        "routine_type":     routine.routine_type,
        "schedule":         routine.schedule or 'daily',
        "family_member_id": routine.family_member_id,
        "enabled":          routine.enabled,
        "sort_order":       routine.sort_order,
        "items": [
            {
                "id":            item.id,
                "routine_id":    item.routine_id,
                "title":         item.title,
                "schedule":      item.schedule or 'daily',
                "sort_order":    item.sort_order,
                "completion_id": done.get(item.id),
            }
            for item in routine.items
        ],
    }

# ── routes ────────────────────────────────────────────────────────────────────

@router.get("/")
def list_routines(date: str = None, db: Session = Depends(get_db)):
    if not date:
        date = datetime.date.today().isoformat()
    routines = db.query(Routine).order_by(Routine.sort_order, Routine.id).all()
    completions = db.query(RoutineCompletion).filter(RoutineCompletion.date == date).all()
    done = {c.routine_item_id: c.id for c in completions}
    return [_out(r, done) for r in routines]

@router.post("/", status_code=201)
def create_routine(data: RoutineCreate, db: Session = Depends(get_db)):
    r = Routine(**data.model_dump(), created_at=datetime.datetime.utcnow())
    db.add(r); db.commit(); db.refresh(r)
    return _out(r, {})

@router.patch("/{routine_id}")
def update_routine(routine_id: int, data: RoutineUpdate, db: Session = Depends(get_db)):
    r = db.query(Routine).filter(Routine.id == routine_id).first()
    if not r: raise HTTPException(404)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(r, k, v)
    db.commit(); db.refresh(r)
    return _out(r, {})

@router.delete("/{routine_id}", status_code=204)
def delete_routine(routine_id: int, db: Session = Depends(get_db)):
    r = db.query(Routine).filter(Routine.id == routine_id).first()
    if not r: raise HTTPException(404)
    db.delete(r); db.commit()

@router.post("/{routine_id}/items/", status_code=201)
def add_item(routine_id: int, data: ItemCreate, db: Session = Depends(get_db)):
    r = db.query(Routine).filter(Routine.id == routine_id).first()
    if not r: raise HTTPException(404)
    next_order = max((i.sort_order for i in r.items), default=-1) + 1
    item = RoutineItem(routine_id=routine_id, title=data.title,
                       schedule=data.schedule, sort_order=next_order,
                       created_at=datetime.datetime.utcnow())
    db.add(item); db.commit(); db.refresh(r)
    return _out(r, {})

@router.patch("/items/{item_id}")
def update_item(item_id: int, data: ItemUpdate, db: Session = Depends(get_db)):
    item = db.query(RoutineItem).filter(RoutineItem.id == item_id).first()
    if not item: raise HTTPException(404)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    db.commit()
    r = db.query(Routine).filter(Routine.id == item.routine_id).first()
    return _out(r, {})

@router.post("/{routine_id}/items/reorder")
def reorder_items(routine_id: int, ids: list[int], db: Session = Depends(get_db)):
    for order, item_id in enumerate(ids):
        item = db.query(RoutineItem).filter(RoutineItem.id == item_id, RoutineItem.routine_id == routine_id).first()
        if item:
            item.sort_order = order
    db.commit()
    r = db.query(Routine).filter(Routine.id == routine_id).first()
    return _out(r, {})

@router.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(RoutineItem).filter(RoutineItem.id == item_id).first()
    if not item: raise HTTPException(404)
    db.delete(item); db.commit()

@router.post("/completions/", status_code=201)
def mark_complete(data: CompletionCreate, db: Session = Depends(get_db)):
    existing = db.query(RoutineCompletion).filter(
        RoutineCompletion.routine_item_id == data.routine_item_id,
        RoutineCompletion.date == data.date,
    ).first()
    if existing:
        return {"id": existing.id}
    c = RoutineCompletion(routine_item_id=data.routine_item_id, date=data.date,
                          created_at=datetime.datetime.utcnow())
    db.add(c); db.commit(); db.refresh(c)
    return {"id": c.id}

@router.delete("/completions/{completion_id}", status_code=204)
def unmark_complete(completion_id: int, db: Session = Depends(get_db)):
    c = db.query(RoutineCompletion).filter(RoutineCompletion.id == completion_id).first()
    if not c: raise HTTPException(404)
    db.delete(c); db.commit()
