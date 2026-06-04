from __future__ import annotations
import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import Department, ShoppingItem, Staple, Store
from ..schemas import (
    Department as DepartmentSchema, DepartmentCreate, DepartmentUpdate,
    ShoppingItem as ShoppingItemSchema, ShoppingItemCreate, ShoppingItemUpdate,
    Staple as StapleSchema, StapleCreate, StapleUpdate,
    Store as StoreSchema, StoreCreate, StoreUpdate,
)

router = APIRouter()


# ── helpers ──────────────────────────────────────────────────────────────────

def _store_out(s: Store) -> dict:
    return StoreSchema.model_validate(s).model_dump()

def _dept_out(d: Department) -> dict:
    return DepartmentSchema.model_validate(d).model_dump()

def _item_out(i: ShoppingItem) -> dict:
    d = ShoppingItemSchema.model_validate(i).model_dump()
    d["store_name"] = i.store.name if i.store else None
    d["department_name"] = i.department.name if i.department else None
    return d

def _staple_out(s: Staple) -> dict:
    d = StapleSchema.model_validate(s).model_dump()
    d["store_name"] = s.store.name if s.store else None
    d["department_name"] = s.department.name if s.department else None
    return d


# ── stores ────────────────────────────────────────────────────────────────────

@router.get("/stores")
def list_stores(db: Session = Depends(get_db)):
    stores = db.query(Store).order_by(Store.name).all()
    return [_store_out(s) for s in stores]

@router.post("/stores", status_code=201)
def create_store(data: StoreCreate, db: Session = Depends(get_db)):
    if data.is_default:
        db.query(Store).update({Store.is_default: False})
    store = Store(name=data.name, is_default=data.is_default)
    db.add(store)
    db.commit()
    db.refresh(store)
    return _store_out(store)

@router.patch("/stores/{store_id}")
def update_store(store_id: int, data: StoreUpdate, db: Session = Depends(get_db)):
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(404, "Store not found")
    if data.is_default:
        db.query(Store).filter(Store.id != store_id).update({Store.is_default: False})
    updates = data.model_dump(exclude_unset=True)
    for field, val in updates.items():
        setattr(store, field, val)
    db.commit()
    db.refresh(store)
    return _store_out(store)

@router.delete("/stores/{store_id}", status_code=204)
def delete_store(store_id: int, db: Session = Depends(get_db)):
    store = db.query(Store).filter(Store.id == store_id).first()
    if not store:
        raise HTTPException(404, "Store not found")
    db.delete(store)
    db.commit()


# ── departments ───────────────────────────────────────────────────────────────

@router.get("/departments")
def list_departments(db: Session = Depends(get_db)):
    depts = db.query(Department).order_by(Department.name).all()
    return [_dept_out(d) for d in depts]

@router.post("/departments", status_code=201)
def create_department(data: DepartmentCreate, db: Session = Depends(get_db)):
    dept = Department(name=data.name)
    db.add(dept)
    db.commit()
    db.refresh(dept)
    return _dept_out(dept)

@router.patch("/departments/{dept_id}")
def update_department(dept_id: int, data: DepartmentUpdate, db: Session = Depends(get_db)):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(404, "Department not found")
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(dept, field, val)
    db.commit()
    db.refresh(dept)
    return _dept_out(dept)

@router.delete("/departments/{dept_id}", status_code=204)
def delete_department(dept_id: int, db: Session = Depends(get_db)):
    dept = db.query(Department).filter(Department.id == dept_id).first()
    if not dept:
        raise HTTPException(404, "Department not found")
    db.delete(dept)
    db.commit()


# ── shopping items ────────────────────────────────────────────────────────────

@router.get("/items")
def list_items(db: Session = Depends(get_db)):
    items = db.query(ShoppingItem).order_by(ShoppingItem.created_at).all()
    return [_item_out(i) for i in items]

@router.post("/items", status_code=201)
def create_item(data: ShoppingItemCreate, db: Session = Depends(get_db)):
    now = datetime.datetime.utcnow()
    item = ShoppingItem(**data.model_dump(), created_at=now, updated_at=now)
    db.add(item)
    db.commit()
    db.refresh(item)
    return _item_out(item)

@router.patch("/items/{item_id}")
def update_item(item_id: int, data: ShoppingItemUpdate, db: Session = Depends(get_db)):
    item = db.query(ShoppingItem).filter(ShoppingItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(item, field, val)
    item.updated_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(item)
    return _item_out(item)

@router.delete("/items/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(ShoppingItem).filter(ShoppingItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    db.delete(item)
    db.commit()

@router.delete("/items/completed/all", status_code=204)
def delete_completed(db: Session = Depends(get_db)):
    db.query(ShoppingItem).filter(ShoppingItem.completed == True).delete()
    db.commit()

@router.post("/items/{item_id}/archive")
def archive_as_staple(item_id: int, db: Session = Depends(get_db)):
    item = db.query(ShoppingItem).filter(ShoppingItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    staple = Staple(
        brand=item.brand,
        description=item.description,
        upc=item.upc,
        store_id=item.store_id,
        department_id=item.department_id,
        quantity=item.quantity,
        unit=item.unit,
        price_per_unit=item.price_per_unit,
        taxable=item.taxable,
        tax_rate=item.tax_rate,
        notes=item.notes,
    )
    db.add(staple)
    db.commit()
    db.refresh(staple)
    return _staple_out(staple)


# ── staples ───────────────────────────────────────────────────────────────────

@router.get("/staples")
def list_staples(db: Session = Depends(get_db)):
    staples = db.query(Staple).order_by(Staple.description).all()
    return [_staple_out(s) for s in staples]

@router.post("/staples", status_code=201)
def create_staple(data: StapleCreate, db: Session = Depends(get_db)):
    staple = Staple(**data.model_dump())
    db.add(staple)
    db.commit()
    db.refresh(staple)
    return _staple_out(staple)

@router.patch("/staples/{staple_id}")
def update_staple(staple_id: int, data: StapleUpdate, db: Session = Depends(get_db)):
    staple = db.query(Staple).filter(Staple.id == staple_id).first()
    if not staple:
        raise HTTPException(404, "Staple not found")
    for field, val in data.model_dump(exclude_unset=True).items():
        setattr(staple, field, val)
    db.commit()
    db.refresh(staple)
    return _staple_out(staple)

@router.delete("/staples/{staple_id}", status_code=204)
def delete_staple(staple_id: int, db: Session = Depends(get_db)):
    staple = db.query(Staple).filter(Staple.id == staple_id).first()
    if not staple:
        raise HTTPException(404, "Staple not found")
    db.delete(staple)
    db.commit()

@router.post("/staples/{staple_id}/add-to-list", status_code=201)
def add_staple_to_list(staple_id: int, db: Session = Depends(get_db)):
    staple = db.query(Staple).filter(Staple.id == staple_id).first()
    if not staple:
        raise HTTPException(404, "Staple not found")
    now = datetime.datetime.utcnow()
    item = ShoppingItem(
        brand=staple.brand,
        description=staple.description,
        upc=staple.upc,
        store_id=staple.store_id,
        department_id=staple.department_id,
        quantity=staple.quantity,
        unit=staple.unit,
        price_per_unit=staple.price_per_unit,
        taxable=staple.taxable,
        tax_rate=staple.tax_rate,
        notes=staple.notes,
        created_at=now,
        updated_at=now,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _item_out(item)
