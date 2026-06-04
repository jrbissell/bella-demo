import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from .database import Base


class FamilyMember(Base):
    __tablename__ = "family_members"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    color = Column(String, nullable=False, default="#6366F1")
    icloud_calendar_name = Column(String, nullable=False)
    calendar_url = Column(String)
    icloud_reminders_list = Column(String)   # optional — name of their iCloud Reminders list
    reminders_list_url = Column(String)      # cached CalDAV URL for that list
    sort_order = Column(Integer, default=99)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    events = relationship("CalendarEvent", back_populates="family_member", cascade="all, delete-orphan")
    chores = relationship("Chore", back_populates="family_member", cascade="all, delete-orphan")


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id = Column(Integer, primary_key=True, index=True)
    uid = Column(String, unique=True, nullable=False, index=True)
    family_member_id = Column(Integer, ForeignKey("family_members.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    all_day = Column(Boolean, default=False)
    location = Column(String)
    description = Column(Text)
    recurrence_rule = Column(String)
    event_url = Column(String)   # CalDAV URL for direct PUT updates; avoids REPORT search
    last_synced = Column(DateTime)
    raw_ical = Column(Text)

    family_member = relationship("FamilyMember", back_populates="events")


class Chore(Base):
    __tablename__ = "chores"

    id = Column(Integer, primary_key=True, index=True)
    uid = Column(String, unique=True, nullable=False, index=True)
    family_member_id = Column(Integer, ForeignKey("family_members.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    notes = Column(Text)
    due_date = Column(DateTime)
    priority = Column(Integer, default=0)   # 0=none 1=high 5=medium 9=low (iCal standard)
    completed = Column(Boolean, default=False)
    completed_at = Column(DateTime)
    recurrence_rule = Column(String)
    chore_type = Column(String)   # null=standard | honey_do
    last_synced = Column(DateTime)
    raw_ical = Column(Text)

    family_member = relationship("FamilyMember", back_populates="chores")


class TrackerItem(Base):
    __tablename__ = "tracker_items"

    id = Column(Integer, primary_key=True, index=True)
    item_type = Column(String, nullable=False, default="bug")   # bug | feature | change | remove
    title = Column(String, nullable=False)
    description = Column(Text)
    status = Column(String, nullable=False, default="open")     # open | in_progress | completed
    priority = Column(Integer, default=0)                        # 0=none 1=high 5=medium 9=low
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)


# ── Shopping ──────────────────────────────────────────────────────────────────

class Store(Base):
    __tablename__ = "stores"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    items = relationship("ShoppingItem", back_populates="store")
    staples = relationship("Staple", back_populates="store")


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    items = relationship("ShoppingItem", back_populates="department")
    staples = relationship("Staple", back_populates="department")


class ShoppingItem(Base):
    __tablename__ = "shopping_items"

    id = Column(Integer, primary_key=True, index=True)
    brand = Column(String)
    description = Column(String, nullable=False)
    upc = Column(String)
    store_id = Column(Integer, ForeignKey("stores.id", ondelete="SET NULL"), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    quantity = Column(Float, default=1.0)
    unit = Column(String, default="each")
    price_per_unit = Column(Float)
    taxable = Column(Boolean, default=False)
    tax_rate = Column(Float, default=8.25)
    notes = Column(Text)
    completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)

    store = relationship("Store", back_populates="items")
    department = relationship("Department", back_populates="items")


class Staple(Base):
    __tablename__ = "staples"

    id = Column(Integer, primary_key=True, index=True)
    brand = Column(String)
    description = Column(String, nullable=False)
    upc = Column(String)
    store_id = Column(Integer, ForeignKey("stores.id", ondelete="SET NULL"), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    quantity = Column(Float, default=1.0)
    unit = Column(String, default="each")
    price_per_unit = Column(Float)
    taxable = Column(Boolean, default=False)
    tax_rate = Column(Float, default=8.25)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    store = relationship("Store", back_populates="staples")
    department = relationship("Department", back_populates="staples")


# ── Meals ─────────────────────────────────────────────────────────────────────

class Recipe(Base):
    __tablename__ = "recipes"

    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String, nullable=False)
    description  = Column(Text)
    source_url   = Column(String)
    servings     = Column(Integer)          # number of servings
    serving_size = Column(String)           # e.g. "1 cup (240 ml)"
    calories     = Column(Float)            # per serving
    protein_g    = Column(Float)            # per serving
    carbs_g      = Column(Float)            # per serving
    fat_g        = Column(Float)            # per serving
    ingredients  = Column(Text)             # JSON array of strings
    instructions = Column(Text)             # JSON array of strings
    created_at   = Column(DateTime, default=datetime.datetime.utcnow)

    meals = relationship("Meal", back_populates="recipe")


class Meal(Base):
    __tablename__ = "meals"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String, nullable=False)
    category    = Column(String, default="Other")
    description = Column(Text)
    prep_time   = Column(Integer)
    url         = Column(String)
    notes       = Column(Text)
    recipe_id   = Column(Integer, ForeignKey("recipes.id", ondelete="SET NULL"), nullable=True)
    created_at  = Column(DateTime, default=datetime.datetime.utcnow)

    plan_entries = relationship("MealPlan", back_populates="meal")
    recipe       = relationship("Recipe", back_populates="meals")


class MealPlan(Base):
    __tablename__ = "meal_plan"

    id              = Column(Integer, primary_key=True, index=True)
    meal_id         = Column(Integer, ForeignKey("meals.id", ondelete="SET NULL"), nullable=True)
    title           = Column(String, nullable=False)   # meal name or custom text
    date            = Column(String, nullable=False)   # YYYY-MM-DD
    notes           = Column(Text)
    recurrence_rule = Column(Text)
    created_at      = Column(DateTime, default=datetime.datetime.utcnow)

    meal = relationship("Meal", back_populates="plan_entries")


# ── Budget ────────────────────────────────────────────────────────────────────

class BudgetMonth(Base):
    __tablename__ = "budget_months"

    id         = Column(String, primary_key=True)   # "YYYY-MM"
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    income   = relationship("BudgetIncome",  back_populates="month",
                            cascade="all, delete-orphan", order_by="BudgetIncome.sort_order")
    expenses = relationship("BudgetExpense", back_populates="month",
                            cascade="all, delete-orphan", order_by="BudgetExpense.sort_order")
    debts    = relationship("BudgetDebt",    back_populates="month",
                            cascade="all, delete-orphan", order_by="BudgetDebt.sort_order")


class BudgetIncome(Base):
    __tablename__ = "budget_income"

    id             = Column(Integer, primary_key=True, index=True)
    month_id       = Column(String, ForeignKey("budget_months.id", ondelete="CASCADE"), nullable=False)
    identifier     = Column(String)
    name           = Column(String, nullable=False)
    pay_day        = Column(Integer)
    pay_last_day   = Column(Boolean, default=False)
    planned_amount = Column(Float, default=0.0)
    actual_amount  = Column(Float, default=0.0)
    received       = Column(Boolean, default=False)
    one_time       = Column(Boolean, default=False)
    sort_order     = Column(Integer, default=0)
    created_at     = Column(DateTime, default=datetime.datetime.utcnow)

    month = relationship("BudgetMonth", back_populates="income")


class BudgetExpense(Base):
    __tablename__ = "budget_expenses"

    id                = Column(Integer, primary_key=True, index=True)
    month_id          = Column(String, ForeignKey("budget_months.id", ondelete="CASCADE"), nullable=False)
    category          = Column(String, nullable=False)
    name              = Column(String, nullable=False)
    due_day           = Column(Integer)
    due_last_day      = Column(Boolean, default=False)
    planned_amount    = Column(Float, default=0.0)
    actual_amount     = Column(Float, default=0.0)
    paid              = Column(Boolean, default=False)
    income_identifier = Column(String)
    one_time          = Column(Boolean, default=False)
    autopay           = Column(Boolean, default=False)
    payment_url       = Column(String)
    sort_order        = Column(Integer, default=0)
    created_at        = Column(DateTime, default=datetime.datetime.utcnow)

    month = relationship("BudgetMonth", back_populates="expenses")


class BudgetDebt(Base):
    __tablename__ = "budget_debts"

    id                = Column(Integer, primary_key=True, index=True)
    month_id          = Column(String, ForeignKey("budget_months.id", ondelete="CASCADE"), nullable=False)
    name              = Column(String, nullable=False)
    due_day           = Column(Integer)
    due_last_day      = Column(Boolean, default=False)
    minimum_payment   = Column(Float, default=0.0)
    planned_amount    = Column(Float, default=0.0)
    actual_amount     = Column(Float, default=0.0)
    paid              = Column(Boolean, default=False)
    income_identifier = Column(String)
    one_time          = Column(Boolean, default=False)
    autopay           = Column(Boolean, default=False)
    payment_url       = Column(String)
    sort_order        = Column(Integer, default=0)
    created_at        = Column(DateTime, default=datetime.datetime.utcnow)

    month = relationship("BudgetMonth", back_populates="debts")


# ── Savings (global — not per-month) ──────────────────────────────────────────

class SavingsEnvelope(Base):
    __tablename__ = "savings_envelopes"

    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String, nullable=False)
    target_amount = Column(Float, default=0.0)
    sort_order    = Column(Integer, default=0)
    created_at    = Column(DateTime, default=datetime.datetime.utcnow)

    transactions = relationship("SavingsTransaction", back_populates="envelope",
                                cascade="all, delete-orphan",
                                order_by="SavingsTransaction.date")


class SavingsTransaction(Base):
    __tablename__ = "savings_transactions"

    id                = Column(Integer, primary_key=True, index=True)
    envelope_id       = Column(Integer, ForeignKey("savings_envelopes.id", ondelete="CASCADE"), nullable=False)
    tx_type           = Column(String, nullable=False)   # "in" | "out"
    amount            = Column(Float, nullable=False)
    date              = Column(String, nullable=False)   # YYYY-MM-DD
    note              = Column(String)
    income_identifier = Column(String)                   # A-Z check that funded this tx
    created_at        = Column(DateTime, default=datetime.datetime.utcnow)

    envelope = relationship("SavingsEnvelope", back_populates="transactions")


# ── Auto Savings (global) ─────────────────────────────────────────────────────

class AutoSavingsConfig(Base):
    __tablename__ = "auto_savings_config"

    id             = Column(Integer, primary_key=True)   # always 1
    check_ids      = Column(String, default='[]')         # JSON array e.g. '["A","B","C","D"]'
    nm_envelope_id = Column(Integer, ForeignKey("savings_envelopes.id", ondelete="SET NULL"), nullable=True)


class AutoSavingsGoal(Base):
    __tablename__ = "auto_savings_goals"

    id          = Column(Integer, primary_key=True, index=True)
    name             = Column(String, nullable=False)
    amount_type      = Column(String, default="fixed")   # "fixed" | "per_friday"
    amount           = Column(Float,  default=0.0)
    envelope_id      = Column(Integer, ForeignKey("savings_envelopes.id", ondelete="SET NULL"), nullable=True)
    deposit_on_rcvd  = Column(Boolean, default=False)    # deposit directly to envelope when check is received
    sort_order       = Column(Integer, default=0)
    created_at       = Column(DateTime, default=datetime.datetime.utcnow)


# ── Routines ──────────────────────────────────────────────────────────────────

class Routine(Base):
    __tablename__ = "routines"

    id               = Column(Integer, primary_key=True, index=True)
    family_member_id = Column(Integer, ForeignKey("family_members.id", ondelete="SET NULL"), nullable=True)
    name             = Column(String, nullable=False)
    routine_type     = Column(String, nullable=False)  # morning | evening | daily
    schedule         = Column(String, default='daily')  # daily | weekdays | weekends
    enabled          = Column(Boolean, default=True)
    sort_order       = Column(Integer, default=0)
    created_at       = Column(DateTime, default=datetime.datetime.utcnow)

    items = relationship("RoutineItem", back_populates="routine",
                         cascade="all, delete-orphan", order_by="RoutineItem.sort_order")


class RoutineItem(Base):
    __tablename__ = "routine_items"

    id         = Column(Integer, primary_key=True, index=True)
    routine_id = Column(Integer, ForeignKey("routines.id", ondelete="CASCADE"), nullable=False)
    title      = Column(String, nullable=False)
    schedule   = Column(String, default='daily')   # daily | weekdays | weekends
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    routine = relationship("Routine", back_populates="items")


class RoutineCompletion(Base):
    __tablename__ = "routine_completions"

    id              = Column(Integer, primary_key=True, index=True)
    routine_item_id = Column(Integer, ForeignKey("routine_items.id", ondelete="CASCADE"), nullable=False)
    date            = Column(String, nullable=False)   # YYYY-MM-DD
    created_at      = Column(DateTime, default=datetime.datetime.utcnow)
