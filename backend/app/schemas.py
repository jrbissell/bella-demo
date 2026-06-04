from __future__ import annotations
import datetime
from typing import Optional
from pydantic import BaseModel


# ── Family Members ──────────────────────────────────────────────────────────

class FamilyMemberBase(BaseModel):
    name: str
    color: str = "#6366F1"
    icloud_calendar_name: str
    icloud_reminders_list: Optional[str] = None


class FamilyMemberCreate(FamilyMemberBase):
    pass


class FamilyMemberUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    icloud_calendar_name: Optional[str] = None
    icloud_reminders_list: Optional[str] = None


class FamilyMember(FamilyMemberBase):
    id: int
    calendar_url: Optional[str] = None
    reminders_list_url: Optional[str] = None
    sort_order: int = 99
    created_at: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True


# ── Calendar Events ──────────────────────────────────────────────────────────

class EventBase(BaseModel):
    title: str
    start_time: datetime.datetime
    end_time: datetime.datetime
    all_day: bool = False
    location: Optional[str] = None
    description: Optional[str] = None
    recurrence_rule: Optional[str] = None
    family_member_id: int


class EventCreate(EventBase):
    pass


class EventSplitRequest(EventCreate):
    occurrence_date: datetime.datetime


class EventUpdate(BaseModel):
    title: Optional[str] = None
    start_time: Optional[datetime.datetime] = None
    end_time: Optional[datetime.datetime] = None
    all_day: Optional[bool] = None
    location: Optional[str] = None
    description: Optional[str] = None
    family_member_id: Optional[int] = None


class CalendarEvent(EventBase):
    id: int
    uid: str
    last_synced: Optional[datetime.datetime] = None
    family_member_name: Optional[str] = None
    family_member_color: Optional[str] = None

    class Config:
        from_attributes = True


# ── Chores ────────────────────────────────────────────────────────────────────

class ChoreBase(BaseModel):
    title: str
    notes: Optional[str] = None
    due_date: Optional[datetime.datetime] = None
    priority: int = 0             # 0=none 1=high 5=medium 9=low (iCal PRIORITY)
    recurrence_rule: Optional[str] = None
    family_member_id: int
    chore_type: Optional[str] = None   # None=standard | honey_do


class ChoreCreate(ChoreBase):
    pass


class ChoreUpdate(BaseModel):
    title: Optional[str] = None
    notes: Optional[str] = None
    due_date: Optional[datetime.datetime] = None
    priority: Optional[int] = None
    recurrence_rule: Optional[str] = None
    family_member_id: Optional[int] = None
    completed: Optional[bool] = None
    chore_type: Optional[str] = None


class Chore(ChoreBase):
    id: int
    uid: str
    completed: bool = False
    completed_at: Optional[datetime.datetime] = None
    last_synced: Optional[datetime.datetime] = None
    family_member_name: Optional[str] = None
    family_member_color: Optional[str] = None

    class Config:
        from_attributes = True


# ── Tracker ───────────────────────────────────────────────────────────────────

class TrackerItemBase(BaseModel):
    item_type: str = "bug"       # bug | feature | change | remove
    title: str
    description: Optional[str] = None
    status: str = "open"         # open | in_progress | completed
    priority: int = 0            # 0=none 1=high 5=medium 9=low


class TrackerItemCreate(TrackerItemBase):
    pass


class TrackerItemUpdate(BaseModel):
    item_type: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[int] = None


class TrackerItem(TrackerItemBase):
    id: int
    created_at: datetime.datetime
    updated_at: datetime.datetime

    class Config:
        from_attributes = True


# ── Shopping ──────────────────────────────────────────────────────────────────

class StoreBase(BaseModel):
    name: str
    is_default: bool = False

class StoreCreate(StoreBase):
    pass

class StoreUpdate(BaseModel):
    name: Optional[str] = None
    is_default: Optional[bool] = None

class Store(StoreBase):
    id: int
    created_at: datetime.datetime
    class Config:
        from_attributes = True


class DepartmentBase(BaseModel):
    name: str

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentUpdate(BaseModel):
    name: Optional[str] = None

class Department(DepartmentBase):
    id: int
    created_at: datetime.datetime
    class Config:
        from_attributes = True


class ShoppingItemBase(BaseModel):
    brand: Optional[str] = None
    description: str
    upc: Optional[str] = None
    store_id: Optional[int] = None
    department_id: Optional[int] = None
    quantity: float = 1.0
    unit: str = "each"
    price_per_unit: Optional[float] = None
    taxable: bool = False
    tax_rate: float = 8.25
    notes: Optional[str] = None

class ShoppingItemCreate(ShoppingItemBase):
    pass

class ShoppingItemUpdate(BaseModel):
    brand: Optional[str] = None
    description: Optional[str] = None
    upc: Optional[str] = None
    store_id: Optional[int] = None
    department_id: Optional[int] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    price_per_unit: Optional[float] = None
    taxable: Optional[bool] = None
    tax_rate: Optional[float] = None
    notes: Optional[str] = None
    completed: Optional[bool] = None

class ShoppingItem(ShoppingItemBase):
    id: int
    completed: bool = False
    store_name: Optional[str] = None
    department_name: Optional[str] = None
    created_at: datetime.datetime
    updated_at: datetime.datetime
    class Config:
        from_attributes = True


class StapleBase(BaseModel):
    brand: Optional[str] = None
    description: str
    upc: Optional[str] = None
    store_id: Optional[int] = None
    department_id: Optional[int] = None
    quantity: float = 1.0
    unit: str = "each"
    price_per_unit: Optional[float] = None
    taxable: bool = False
    tax_rate: float = 8.25
    notes: Optional[str] = None

class StapleCreate(StapleBase):
    pass

class StapleUpdate(BaseModel):
    brand: Optional[str] = None
    description: Optional[str] = None
    upc: Optional[str] = None
    store_id: Optional[int] = None
    department_id: Optional[int] = None
    quantity: Optional[float] = None
    unit: Optional[str] = None
    price_per_unit: Optional[float] = None
    taxable: Optional[bool] = None
    tax_rate: Optional[float] = None
    notes: Optional[str] = None

class Staple(StapleBase):
    id: int
    store_name: Optional[str] = None
    department_name: Optional[str] = None
    created_at: datetime.datetime
    class Config:
        from_attributes = True


# ── Recipes ───────────────────────────────────────────────────────────────────

class RecipeBase(BaseModel):
    name:         str
    description:  Optional[str] = None
    source_url:   Optional[str] = None
    servings:     Optional[int] = None
    serving_size: Optional[str] = None
    calories:     Optional[float] = None
    protein_g:    Optional[float] = None
    carbs_g:      Optional[float] = None
    fat_g:        Optional[float] = None
    ingredients:  Optional[str] = None   # JSON string
    instructions: Optional[str] = None  # JSON string

class RecipeCreate(RecipeBase):
    pass

class RecipeUpdate(BaseModel):
    name:         Optional[str]   = None
    description:  Optional[str]   = None
    source_url:   Optional[str]   = None
    servings:     Optional[int]   = None
    serving_size: Optional[str]   = None
    calories:     Optional[float] = None
    protein_g:    Optional[float] = None
    carbs_g:      Optional[float] = None
    fat_g:        Optional[float] = None
    ingredients:  Optional[str]   = None
    instructions: Optional[str]   = None

class Recipe(RecipeBase):
    id: int
    created_at: datetime.datetime
    class Config:
        from_attributes = True


# ── Meals ─────────────────────────────────────────────────────────────────────

class MealBase(BaseModel):
    name:        str
    category:    str = "Other"
    description: Optional[str] = None
    prep_time:   Optional[int] = None
    url:         Optional[str] = None
    notes:       Optional[str] = None
    recipe_id:   Optional[int] = None

class MealCreate(MealBase):
    pass

class MealUpdate(BaseModel):
    name:        Optional[str] = None
    category:    Optional[str] = None
    description: Optional[str] = None
    prep_time:   Optional[int] = None
    url:         Optional[str] = None
    notes:       Optional[str] = None
    recipe_id:   Optional[int] = None

class Meal(MealBase):
    id:          int
    created_at:  datetime.datetime
    recipe_name: Optional[str] = None
    class Config:
        from_attributes = True


class MealPlanBase(BaseModel):
    title: str
    date: str                          # YYYY-MM-DD
    meal_id: Optional[int] = None
    notes: Optional[str] = None
    recurrence_rule: Optional[str] = None

class MealPlanCreate(MealPlanBase):
    pass

class MealPlanUpdate(BaseModel):
    title: Optional[str] = None
    date: Optional[str] = None
    meal_id: Optional[int] = None
    notes: Optional[str] = None
    recurrence_rule: Optional[str] = None

class MealPlan(MealPlanBase):
    id: int
    created_at: datetime.datetime
    class Config:
        from_attributes = True


# ── Budget ────────────────────────────────────────────────────────────────────

class BudgetMonthBase(BaseModel):
    id: str   # "YYYY-MM"

class BudgetMonthCreate(BudgetMonthBase):
    copy_from: Optional[str] = None   # source YYYY-MM to copy income/expenses/debts from

class BudgetMonth(BudgetMonthBase):
    created_at: datetime.datetime
    class Config:
        from_attributes = True


class BudgetIncomeBase(BaseModel):
    month_id:       str
    identifier:     Optional[str]   = None
    name:           str
    pay_day:        Optional[int]   = None
    pay_last_day:   bool            = False
    planned_amount: float           = 0.0
    actual_amount:  float           = 0.0
    received:       bool            = False
    one_time:       bool            = False
    sort_order:     int             = 0

class BudgetIncomeCreate(BudgetIncomeBase):
    pass

class BudgetIncomeUpdate(BaseModel):
    identifier:     Optional[str]   = None
    name:           Optional[str]   = None
    pay_day:        Optional[int]   = None
    pay_last_day:   Optional[bool]  = None
    planned_amount: Optional[float] = None
    actual_amount:  Optional[float] = None
    received:       Optional[bool]  = None
    one_time:       Optional[bool]  = None
    sort_order:     Optional[int]   = None

class BudgetIncome(BudgetIncomeBase):
    id: int
    created_at: datetime.datetime
    class Config:
        from_attributes = True


class BudgetExpenseBase(BaseModel):
    month_id:          str
    category:          str
    name:              str
    due_day:           Optional[int]   = None
    due_last_day:      bool            = False
    planned_amount:    float           = 0.0
    actual_amount:     float           = 0.0
    paid:              bool            = False
    income_identifier: Optional[str]   = None
    one_time:          bool            = False
    autopay:           bool            = False
    payment_url:       Optional[str]   = None
    sort_order:        int             = 0

class BudgetExpenseCreate(BudgetExpenseBase):
    pass

class BudgetExpenseUpdate(BaseModel):
    category:          Optional[str]   = None
    name:              Optional[str]   = None
    due_day:           Optional[int]   = None
    due_last_day:      Optional[bool]  = None
    planned_amount:    Optional[float] = None
    actual_amount:     Optional[float] = None
    paid:              Optional[bool]  = None
    income_identifier: Optional[str]  = None
    one_time:          Optional[bool]  = None
    autopay:           Optional[bool]  = None
    payment_url:       Optional[str]   = None
    sort_order:        Optional[int]  = None

class BudgetExpense(BudgetExpenseBase):
    id: int
    created_at: datetime.datetime
    class Config:
        from_attributes = True


class BudgetDebtBase(BaseModel):
    month_id:          str
    name:              str
    due_day:           Optional[int]   = None
    due_last_day:      bool            = False
    minimum_payment:   float           = 0.0
    planned_amount:    float           = 0.0
    actual_amount:     float           = 0.0
    paid:              bool            = False
    income_identifier: Optional[str]   = None
    one_time:          bool            = False
    autopay:           bool            = False
    payment_url:       Optional[str]   = None
    sort_order:        int             = 0

class BudgetDebtCreate(BudgetDebtBase):
    pass

class BudgetDebtUpdate(BaseModel):
    name:              Optional[str]   = None
    due_day:           Optional[int]   = None
    due_last_day:      Optional[bool]  = None
    minimum_payment:   Optional[float] = None
    planned_amount:    Optional[float] = None
    actual_amount:     Optional[float] = None
    paid:              Optional[bool]  = None
    income_identifier: Optional[str]   = None
    one_time:          Optional[bool]  = None
    autopay:           Optional[bool]  = None
    payment_url:       Optional[str]   = None
    sort_order:        Optional[int]   = None

class BudgetDebt(BudgetDebtBase):
    id: int
    created_at: datetime.datetime
    class Config:
        from_attributes = True


# ── Savings ───────────────────────────────────────────────────────────────────

class SavingsTxBase(BaseModel):
    envelope_id:       int
    tx_type:           str            # "in" | "out"
    amount:            float
    date:              str            # YYYY-MM-DD
    note:              Optional[str] = None
    income_identifier: Optional[str] = None

class SavingsTxCreate(SavingsTxBase):
    pass

class SavingsTx(SavingsTxBase):
    id: int
    created_at: datetime.datetime
    class Config:
        from_attributes = True


class SavingsEnvelopeBase(BaseModel):
    name:          str
    target_amount: float = 0.0
    sort_order:    int   = 0

class SavingsEnvelopeCreate(SavingsEnvelopeBase):
    pass

class SavingsEnvelopeUpdate(BaseModel):
    name:          Optional[str]   = None
    target_amount: Optional[float] = None
    sort_order:    Optional[int]   = None

class SavingsEnvelope(SavingsEnvelopeBase):
    id:           int
    created_at:   datetime.datetime
    transactions: list[SavingsTx] = []
    balance:      float = 0.0
    class Config:
        from_attributes = True


class AutoSavingsConfigSchema(BaseModel):
    check_ids:      list[str]      = []
    nm_envelope_id: Optional[int]  = None

class AutoSavingsGoalBase(BaseModel):
    name:            str
    amount_type:     str           = "fixed"   # "fixed" | "per_friday"
    amount:          float         = 0.0
    envelope_id:     Optional[int] = None
    deposit_on_rcvd: bool          = False
    sort_order:      int           = 0

class AutoSavingsGoalCreate(AutoSavingsGoalBase):
    pass

class AutoSavingsGoalUpdate(BaseModel):
    name:            Optional[str]   = None
    amount_type:     Optional[str]   = None
    amount:          Optional[float] = None
    envelope_id:     Optional[int]   = None
    deposit_on_rcvd: Optional[bool]  = None
    sort_order:      Optional[int]   = None

class AutoSavingsGoal(AutoSavingsGoalBase):
    id: int
    created_at: datetime.datetime
    class Config:
        from_attributes = True


# ── Sync ──────────────────────────────────────────────────────────────────────

class SyncStatus(BaseModel):
    status: str
    message: str
    synced_count: int = 0
    errors: list[str] = []
