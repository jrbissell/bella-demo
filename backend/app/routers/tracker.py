from __future__ import annotations

import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import TrackerItem
from ..schemas import TrackerItem as TrackerItemSchema, TrackerItemCreate, TrackerItemUpdate

router = APIRouter()


def _out(item: TrackerItem) -> dict:
    return TrackerItemSchema.model_validate(item).model_dump()


@router.get("/")
def list_items(db: Session = Depends(get_db)):
    items = db.query(TrackerItem).order_by(TrackerItem.created_at.desc()).all()
    return [_out(i) for i in items]


@router.post("/", status_code=201)
def create_item(data: TrackerItemCreate, db: Session = Depends(get_db)):
    now = datetime.datetime.utcnow()
    item = TrackerItem(
        item_type=data.item_type,
        title=data.title,
        description=data.description,
        status=data.status,
        priority=data.priority,
        created_at=now,
        updated_at=now,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _out(item)


@router.patch("/{item_id}")
def update_item(item_id: int, data: TrackerItemUpdate, db: Session = Depends(get_db)):
    item = db.query(TrackerItem).filter(TrackerItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    updates = data.model_dump(exclude_unset=True)
    for field, val in updates.items():
        setattr(item, field, val)
    item.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(item)
    return _out(item)


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(TrackerItem).filter(TrackerItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    db.delete(item)
    db.commit()
