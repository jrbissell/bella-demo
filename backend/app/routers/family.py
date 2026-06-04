from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import FamilyMember
from ..schemas import FamilyMember as FamilyMemberSchema, FamilyMemberCreate, FamilyMemberUpdate

router = APIRouter()


@router.get("/", response_model=list[FamilyMemberSchema])
def list_members(db: Session = Depends(get_db)):
    return db.query(FamilyMember).order_by(FamilyMember.sort_order, FamilyMember.id).all()


@router.post("/", response_model=FamilyMemberSchema, status_code=201)
def create_member(payload: FamilyMemberCreate, db: Session = Depends(get_db)):
    member = FamilyMember(**payload.model_dump())
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


@router.get("/{member_id}", response_model=FamilyMemberSchema)
def get_member(member_id: int, db: Session = Depends(get_db)):
    member = db.query(FamilyMember).filter(FamilyMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Family member not found")
    return member


@router.patch("/{member_id}", response_model=FamilyMemberSchema)
def update_member(member_id: int, payload: FamilyMemberUpdate, db: Session = Depends(get_db)):
    member = db.query(FamilyMember).filter(FamilyMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Family member not found")

    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(member, field, value)

    # If the calendar name changed, clear the cached URL so sync re-discovers it
    if "icloud_calendar_name" in updates:
        member.calendar_url = None

    db.commit()
    db.refresh(member)
    return member


@router.delete("/{member_id}", status_code=204)
def delete_member(member_id: int, db: Session = Depends(get_db)):
    member = db.query(FamilyMember).filter(FamilyMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Family member not found")
    db.delete(member)
    db.commit()
