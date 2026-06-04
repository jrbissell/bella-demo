from __future__ import annotations
import datetime
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import (BudgetMonth, BudgetIncome, BudgetExpense, BudgetDebt,
                      SavingsEnvelope, SavingsTransaction,
                      AutoSavingsConfig, AutoSavingsGoal)
from ..schemas import (
    BudgetMonth as BudgetMonthSchema, BudgetMonthCreate,
    BudgetIncome as BudgetIncomeSchema, BudgetIncomeCreate, BudgetIncomeUpdate,
    BudgetExpense as BudgetExpenseSchema, BudgetExpenseCreate, BudgetExpenseUpdate,
    BudgetDebt as BudgetDebtSchema, BudgetDebtCreate, BudgetDebtUpdate,
    SavingsEnvelope as SavingsEnvelopeSchema, SavingsEnvelopeCreate, SavingsEnvelopeUpdate,
    SavingsTx as SavingsTxSchema, SavingsTxCreate,
    AutoSavingsConfigSchema, AutoSavingsGoal as AutoSavingsGoalSchema,
    AutoSavingsGoalCreate, AutoSavingsGoalUpdate,
)

router = APIRouter()

LETTERS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")


# ── months ────────────────────────────────────────────────────────────────────

@router.get("/months/")
def list_months(db: Session = Depends(get_db)):
    months = db.query(BudgetMonth).order_by(BudgetMonth.id.desc()).all()
    return [BudgetMonthSchema.model_validate(m).model_dump() for m in months]

@router.post("/months/", status_code=201)
def create_month(data: BudgetMonthCreate, db: Session = Depends(get_db)):
    if db.query(BudgetMonth).filter(BudgetMonth.id == data.id).first():
        raise HTTPException(409, "Month already exists")
    month = BudgetMonth(id=data.id, created_at=datetime.datetime.utcnow())
    db.add(month); db.commit(); db.refresh(month)

    # Determine source month to copy from
    src_id = data.copy_from
    if not src_id:
        latest = (db.query(BudgetMonth)
                  .filter(BudgetMonth.id != data.id)
                  .order_by(BudgetMonth.id.desc())
                  .first())
        src_id = latest.id if latest else None

    if src_id:
        for item in db.query(BudgetIncome).filter(BudgetIncome.month_id == src_id, BudgetIncome.one_time == False).all():
            db.add(BudgetIncome(
                month_id=data.id, identifier=item.identifier, name=item.name,
                pay_day=item.pay_day, pay_last_day=item.pay_last_day,
                planned_amount=item.planned_amount, actual_amount=0.0,
                received=False, one_time=False, sort_order=item.sort_order,
                created_at=datetime.datetime.utcnow(),
            ))
        for item in db.query(BudgetExpense).filter(BudgetExpense.month_id == src_id, BudgetExpense.one_time == False).all():
            db.add(BudgetExpense(
                month_id=data.id, category=item.category, name=item.name,
                due_day=item.due_day, due_last_day=item.due_last_day,
                planned_amount=item.planned_amount, actual_amount=0.0,
                paid=False, income_identifier=item.income_identifier,
                one_time=False, autopay=item.autopay, payment_url=item.payment_url,
                sort_order=item.sort_order, created_at=datetime.datetime.utcnow(),
            ))
        for item in db.query(BudgetDebt).filter(BudgetDebt.month_id == src_id, BudgetDebt.one_time == False).all():
            db.add(BudgetDebt(
                month_id=data.id, name=item.name,
                due_day=item.due_day, due_last_day=item.due_last_day,
                minimum_payment=item.minimum_payment,
                planned_amount=item.planned_amount, actual_amount=0.0,
                paid=False, income_identifier=item.income_identifier,
                one_time=False, autopay=item.autopay, payment_url=item.payment_url,
                sort_order=item.sort_order, created_at=datetime.datetime.utcnow(),
            ))
        db.commit()

    return BudgetMonthSchema.model_validate(month).model_dump()

@router.delete("/months/{month_id}", status_code=204)
def delete_month(month_id: str, db: Session = Depends(get_db)):
    month = db.query(BudgetMonth).filter(BudgetMonth.id == month_id).first()
    if not month: raise HTTPException(404, "Month not found")
    db.delete(month); db.commit()


# ── income ────────────────────────────────────────────────────────────────────

@router.get("/income/{month_id}")
def list_income(month_id: str, db: Session = Depends(get_db)):
    items = db.query(BudgetIncome).filter(BudgetIncome.month_id == month_id)\
              .order_by(BudgetIncome.sort_order, BudgetIncome.id).all()
    return [BudgetIncomeSchema.model_validate(i).model_dump() for i in items]

@router.post("/income/", status_code=201)
def create_income(data: BudgetIncomeCreate, db: Session = Depends(get_db)):
    # Auto-assign next available letter if not provided
    if not data.identifier:
        used = {r.identifier for r in db.query(BudgetIncome.identifier)
                .filter(BudgetIncome.month_id == data.month_id).all()
                if r.identifier}
        nxt = next((l for l in LETTERS if l not in used), None)
        data = data.model_copy(update={"identifier": nxt})
    item = BudgetIncome(**data.model_dump(), created_at=datetime.datetime.utcnow())
    db.add(item); db.commit(); db.refresh(item)
    return BudgetIncomeSchema.model_validate(item).model_dump()

@router.patch("/income/{item_id}")
def update_income(item_id: int, data: BudgetIncomeUpdate, db: Session = Depends(get_db)):
    import calendar as _cal
    from datetime import date as _date

    item = db.query(BudgetIncome).filter(BudgetIncome.id == item_id).first()
    if not item: raise HTTPException(404, "Income item not found")

    old_received = item.received
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    new_received = item.received

    # Auto savings deposit/withdrawal when received status changes
    if 'received' in data.model_dump(exclude_unset=True) and old_received != new_received:
        cfg = _get_or_create_config(db)
        assigned = json.loads(cfg.check_ids or '[]')
        if item.identifier and item.identifier in assigned:
            goals = db.query(AutoSavingsGoal).all()
            pool_goals   = [g for g in goals if not g.deposit_on_rcvd]
            direct_goals = [g for g in goals if g.deposit_on_rcvd]

            # ── Next Month pool ───────────────────────────────────────────────
            if cfg.nm_envelope_id:
                bm_year, bm_month = map(int, item.month_id.split('-'))
                nm_year  = bm_year + (1 if bm_month == 12 else 0)
                nm_month = 1 if bm_month == 12 else bm_month + 1
                fridays  = sum(1 for d in range(1, _cal.monthrange(nm_year, nm_month)[1] + 1)
                               if _date(nm_year, nm_month, d).weekday() == 4)
                grand_total = sum(
                    g.amount * fridays if g.amount_type == 'per_friday' else g.amount
                    for g in pool_goals
                )
                per_check = round(grand_total / len(assigned), 2) if assigned else 0
                nm_env = db.query(SavingsEnvelope).filter(SavingsEnvelope.id == cfg.nm_envelope_id).first()
                note = f"Auto Savings: Check {item.identifier}"
                if nm_env and per_check > 0:
                    if new_received:
                        db.add(SavingsTransaction(
                            envelope_id=nm_env.id, tx_type="in",
                            amount=per_check, date=_date.today().isoformat(),
                            note=note, created_at=datetime.datetime.utcnow(),
                        ))
                    else:
                        existing = (db.query(SavingsTransaction)
                                    .filter(SavingsTransaction.envelope_id == nm_env.id,
                                            SavingsTransaction.note == note,
                                            SavingsTransaction.tx_type == "in")
                                    .order_by(SavingsTransaction.created_at.desc())
                                    .first())
                        if existing:
                            db.delete(existing)

            # ── Direct-deposit goals (e.g. tithe) ────────────────────────────
            for goal in direct_goals:
                if not goal.envelope_id or goal.amount <= 0:
                    continue
                env = db.query(SavingsEnvelope).filter(SavingsEnvelope.id == goal.envelope_id).first()
                if not env:
                    continue
                note = f"{goal.name}: Check {item.identifier}"
                if new_received:
                    db.add(SavingsTransaction(
                        envelope_id=env.id, tx_type="in",
                        amount=goal.amount, date=_date.today().isoformat(),
                        note=note, income_identifier=item.identifier,
                        created_at=datetime.datetime.utcnow(),
                    ))
                else:
                    existing = (db.query(SavingsTransaction)
                                .filter(SavingsTransaction.envelope_id == env.id,
                                        SavingsTransaction.note == note,
                                        SavingsTransaction.tx_type == "in")
                                .order_by(SavingsTransaction.created_at.desc())
                                .first())
                    if existing:
                        db.delete(existing)

    db.commit(); db.refresh(item)
    return BudgetIncomeSchema.model_validate(item).model_dump()

@router.delete("/income/{item_id}", status_code=204)
def delete_income(item_id: int, db: Session = Depends(get_db)):
    item = db.query(BudgetIncome).filter(BudgetIncome.id == item_id).first()
    if not item: raise HTTPException(404, "Income item not found")
    db.delete(item); db.commit()


# ── expenses ──────────────────────────────────────────────────────────────────

@router.get("/expenses/{month_id}")
def list_expenses(month_id: str, db: Session = Depends(get_db)):
    items = db.query(BudgetExpense).filter(BudgetExpense.month_id == month_id)\
              .order_by(BudgetExpense.category, BudgetExpense.sort_order, BudgetExpense.id).all()
    return [BudgetExpenseSchema.model_validate(i).model_dump() for i in items]

@router.post("/expenses/", status_code=201)
def create_expense(data: BudgetExpenseCreate, db: Session = Depends(get_db)):
    item = BudgetExpense(**data.model_dump(), created_at=datetime.datetime.utcnow())
    db.add(item); db.commit(); db.refresh(item)
    return BudgetExpenseSchema.model_validate(item).model_dump()

@router.patch("/expenses/{item_id}")
def update_expense(item_id: int, data: BudgetExpenseUpdate, db: Session = Depends(get_db)):
    item = db.query(BudgetExpense).filter(BudgetExpense.id == item_id).first()
    if not item: raise HTTPException(404, "Expense not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    db.commit(); db.refresh(item)
    return BudgetExpenseSchema.model_validate(item).model_dump()

@router.delete("/expenses/{item_id}", status_code=204)
def delete_expense(item_id: int, db: Session = Depends(get_db)):
    item = db.query(BudgetExpense).filter(BudgetExpense.id == item_id).first()
    if not item: raise HTTPException(404, "Expense not found")
    db.delete(item); db.commit()


# ── debts ─────────────────────────────────────────────────────────────────────

@router.get("/debts/{month_id}")
def list_debts(month_id: str, db: Session = Depends(get_db)):
    items = db.query(BudgetDebt).filter(BudgetDebt.month_id == month_id)\
              .order_by(BudgetDebt.sort_order, BudgetDebt.id).all()
    return [BudgetDebtSchema.model_validate(i).model_dump() for i in items]

@router.post("/debts/", status_code=201)
def create_debt(data: BudgetDebtCreate, db: Session = Depends(get_db)):
    item = BudgetDebt(**data.model_dump(), created_at=datetime.datetime.utcnow())
    db.add(item); db.commit(); db.refresh(item)
    return BudgetDebtSchema.model_validate(item).model_dump()

@router.patch("/debts/{item_id}")
def update_debt(item_id: int, data: BudgetDebtUpdate, db: Session = Depends(get_db)):
    item = db.query(BudgetDebt).filter(BudgetDebt.id == item_id).first()
    if not item: raise HTTPException(404, "Debt not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(item, k, v)
    db.commit(); db.refresh(item)
    return BudgetDebtSchema.model_validate(item).model_dump()

@router.delete("/debts/{item_id}", status_code=204)
def delete_debt(item_id: int, db: Session = Depends(get_db)):
    item = db.query(BudgetDebt).filter(BudgetDebt.id == item_id).first()
    if not item: raise HTTPException(404, "Debt not found")
    db.delete(item); db.commit()


# ── savings envelopes ─────────────────────────────────────────────────────────

def _env_out(env: SavingsEnvelope) -> dict:
    txs = env.transactions or []
    balance = sum(t.amount if t.tx_type == "in" else -t.amount for t in txs)
    d = SavingsEnvelopeSchema.model_validate(env).model_dump()
    d["transactions"] = [SavingsTxSchema.model_validate(t).model_dump() for t in txs]
    d["balance"] = round(balance, 2)
    return d

@router.get("/savings/envelopes/")
def list_envelopes(db: Session = Depends(get_db)):
    envs = db.query(SavingsEnvelope).order_by(SavingsEnvelope.sort_order, SavingsEnvelope.id).all()
    return [_env_out(e) for e in envs]

@router.post("/savings/envelopes/", status_code=201)
def create_envelope(data: SavingsEnvelopeCreate, db: Session = Depends(get_db)):
    env = SavingsEnvelope(**data.model_dump(), created_at=datetime.datetime.utcnow())
    db.add(env); db.commit(); db.refresh(env)
    return _env_out(env)

@router.patch("/savings/envelopes/{env_id}")
def update_envelope(env_id: int, data: SavingsEnvelopeUpdate, db: Session = Depends(get_db)):
    env = db.query(SavingsEnvelope).filter(SavingsEnvelope.id == env_id).first()
    if not env: raise HTTPException(404, "Envelope not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(env, k, v)
    db.commit(); db.refresh(env)
    return _env_out(env)

@router.delete("/savings/envelopes/{env_id}", status_code=204)
def delete_envelope(env_id: int, db: Session = Depends(get_db)):
    env = db.query(SavingsEnvelope).filter(SavingsEnvelope.id == env_id).first()
    if not env: raise HTTPException(404, "Envelope not found")
    db.delete(env); db.commit()

class ReorderRequest(BaseModel):
    ids: list[int]

@router.post("/savings/envelopes/reorder")
def reorder_envelopes(data: ReorderRequest, db: Session = Depends(get_db)):
    for order, env_id in enumerate(data.ids):
        db.query(SavingsEnvelope).filter(SavingsEnvelope.id == env_id).update({"sort_order": order})
    db.commit()
    return {"ok": True}


# ── savings transactions ──────────────────────────────────────────────────────

@router.get("/savings/transactions/")
def list_transactions_by_month(month_id: str, db: Session = Depends(get_db)):
    txs = (db.query(SavingsTransaction)
             .filter(SavingsTransaction.date.startswith(month_id),
                     SavingsTransaction.income_identifier.isnot(None))
             .all())
    return [SavingsTxSchema.model_validate(t).model_dump() for t in txs]

@router.post("/savings/envelopes/{env_id}/transactions/", status_code=201)
def add_transaction(env_id: int, data: SavingsTxCreate, db: Session = Depends(get_db)):
    env = db.query(SavingsEnvelope).filter(SavingsEnvelope.id == env_id).first()
    if not env: raise HTTPException(404, "Envelope not found")
    tx = SavingsTransaction(
        envelope_id=env_id,
        tx_type=data.tx_type,
        amount=data.amount,
        date=data.date,
        note=data.note,
        income_identifier=data.income_identifier or None,
        created_at=datetime.datetime.utcnow(),
    )
    db.add(tx); db.commit(); db.refresh(env)
    return _env_out(env)

@router.delete("/savings/transactions/{tx_id}", status_code=204)
def delete_transaction(tx_id: int, db: Session = Depends(get_db)):
    tx = db.query(SavingsTransaction).filter(SavingsTransaction.id == tx_id).first()
    if not tx: raise HTTPException(404, "Transaction not found")
    db.delete(tx); db.commit()


# ── auto savings ──────────────────────────────────────────────────────────────

def _get_or_create_config(db: Session) -> AutoSavingsConfig:
    cfg = db.query(AutoSavingsConfig).filter(AutoSavingsConfig.id == 1).first()
    if not cfg:
        cfg = AutoSavingsConfig(id=1, check_ids='[]', nm_envelope_id=None)
        db.add(cfg); db.commit(); db.refresh(cfg)
    return cfg

@router.get("/auto-savings/config")
def get_auto_savings_config(db: Session = Depends(get_db)):
    cfg = _get_or_create_config(db)
    return {"check_ids": json.loads(cfg.check_ids or '[]'), "nm_envelope_id": cfg.nm_envelope_id}

@router.post("/auto-savings/config")
def save_auto_savings_config(data: AutoSavingsConfigSchema, db: Session = Depends(get_db)):
    cfg = _get_or_create_config(db)
    cfg.check_ids = json.dumps(data.check_ids)
    cfg.nm_envelope_id = data.nm_envelope_id
    db.commit(); db.refresh(cfg)
    return {"check_ids": json.loads(cfg.check_ids), "nm_envelope_id": cfg.nm_envelope_id}

@router.post("/auto-savings/setup-nm")
def setup_nm_envelope(db: Session = Depends(get_db)):
    """Create the Next Month envelope if it doesn't exist and link it to config."""
    cfg = _get_or_create_config(db)
    if cfg.nm_envelope_id:
        env = db.query(SavingsEnvelope).filter(SavingsEnvelope.id == cfg.nm_envelope_id).first()
        if env:
            return _env_out(env)
    env = SavingsEnvelope(name="Next Month", target_amount=0.0, sort_order=-1,
                          created_at=datetime.datetime.utcnow())
    db.add(env); db.commit(); db.refresh(env)
    cfg.nm_envelope_id = env.id
    db.commit()
    return _env_out(env)

@router.get("/auto-savings/goals/")
def list_auto_savings_goals(db: Session = Depends(get_db)):
    goals = db.query(AutoSavingsGoal).order_by(AutoSavingsGoal.sort_order, AutoSavingsGoal.id).all()
    return [AutoSavingsGoalSchema.model_validate(g).model_dump() for g in goals]

@router.post("/auto-savings/goals/", status_code=201)
def create_auto_savings_goal(data: AutoSavingsGoalCreate, db: Session = Depends(get_db)):
    goal = AutoSavingsGoal(**data.model_dump(), created_at=datetime.datetime.utcnow())
    db.add(goal); db.commit(); db.refresh(goal)
    return AutoSavingsGoalSchema.model_validate(goal).model_dump()

@router.patch("/auto-savings/goals/{goal_id}")
def update_auto_savings_goal(goal_id: int, data: AutoSavingsGoalUpdate, db: Session = Depends(get_db)):
    goal = db.query(AutoSavingsGoal).filter(AutoSavingsGoal.id == goal_id).first()
    if not goal: raise HTTPException(404, "Goal not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(goal, k, v)
    db.commit(); db.refresh(goal)
    return AutoSavingsGoalSchema.model_validate(goal).model_dump()

@router.delete("/auto-savings/goals/{goal_id}", status_code=204)
def delete_auto_savings_goal(goal_id: int, db: Session = Depends(get_db)):
    goal = db.query(AutoSavingsGoal).filter(AutoSavingsGoal.id == goal_id).first()
    if not goal: raise HTTPException(404, "Goal not found")
    db.delete(goal); db.commit()


class DistributeRequest(BaseModel):
    fridays: int   # number of Fridays in next month, calculated by frontend

@router.post("/auto-savings/distribute")
def distribute(data: DistributeRequest, db: Session = Depends(get_db)):
    cfg = _get_or_create_config(db)
    if not cfg.nm_envelope_id:
        raise HTTPException(400, "Next Month envelope not configured")

    nm_env = db.query(SavingsEnvelope).filter(SavingsEnvelope.id == cfg.nm_envelope_id).first()
    if not nm_env:
        raise HTTPException(404, "Next Month envelope not found")

    goals = db.query(AutoSavingsGoal).order_by(AutoSavingsGoal.sort_order).all()
    today = datetime.date.today().isoformat()

    # Calculate each goal's amount for this distribution
    items = []
    for g in goals:
        total = g.amount * data.fridays if g.amount_type == "per_friday" else g.amount
        items.append({"goal": g, "total": round(total, 2)})

    grand_total = sum(i["total"] for i in items)
    nm_balance = sum(t.amount if t.tx_type == "in" else -t.amount for t in (nm_env.transactions or []))
    withdraw_amt = min(nm_balance, grand_total)

    if withdraw_amt <= 0:
        raise HTTPException(400, "Next Month envelope has no balance to distribute")

    # Withdraw from Next Month
    nm_tx = SavingsTransaction(envelope_id=nm_env.id, tx_type="out",
                               amount=round(withdraw_amt, 2), date=today,
                               note="Auto Savings distribution",
                               created_at=datetime.datetime.utcnow())
    db.add(nm_tx)

    # Deposit into each goal's envelope
    distributed = []
    for item in items:
        g = item["goal"]
        amt = item["total"]
        if not g.envelope_id or amt <= 0:
            continue
        env = db.query(SavingsEnvelope).filter(SavingsEnvelope.id == g.envelope_id).first()
        if not env:
            continue
        tx = SavingsTransaction(envelope_id=g.envelope_id, tx_type="in",
                                amount=amt, date=today,
                                note=f"Auto Savings: {g.name}",
                                created_at=datetime.datetime.utcnow())
        db.add(tx)
        distributed.append({"name": g.name, "amount": amt, "envelope": env.name})

    db.commit()
    return {"withdrawn": withdraw_amt, "distributed": distributed}
