"""
Seed the Bella demo database with generic Johnson family data.
Run from the backend/ directory: python seed_demo.py
Creates (or replaces) bella.db with clean demo data.
"""
import os
import sys
from pathlib import Path

# Add backend to path so app imports work
sys.path.insert(0, str(Path(__file__).parent))
os.chdir(Path(__file__).parent)

from sqlalchemy import create_engine, text

DB_PATH = Path(__file__).parent / "bella.db"
if DB_PATH.exists():
    DB_PATH.unlink()

engine = create_engine(f"sqlite:///{DB_PATH}")

# Create all tables first
from app.database import create_tables
create_tables()

from datetime import date, datetime, timedelta

today = date.today()

with engine.begin() as conn:

    # ── Family Members ──────────────────────────────────────────
    conn.execute(text("""
        INSERT INTO family_members (name, color, icloud_calendar_name, sort_order)
        VALUES
          ('Family',      '#6366f1', 'Family',   0),
          ('Alex',        '#3b82f6', 'Alex',      1),
          ('Sam',         '#ec4899', 'Sam',       2),
          ('Mia',         '#f59e0b', 'Mia',       3)
    """))

    # Get IDs
    family_id = conn.execute(text("SELECT id FROM family_members WHERE name='Family'")).scalar()
    alex_id   = conn.execute(text("SELECT id FROM family_members WHERE name='Alex'")).scalar()
    sam_id    = conn.execute(text("SELECT id FROM family_members WHERE name='Sam'")).scalar()
    mia_id    = conn.execute(text("SELECT id FROM family_members WHERE name='Mia'")).scalar()

    # ── Calendar Events ─────────────────────────────────────────
    events = [
        (family_id, "Family Game Night",      today + timedelta(days=2),  today + timedelta(days=2),  True,  None,       None),
        (family_id, "Dentist Appointment",    today + timedelta(days=5),  today + timedelta(days=5),  True,  None,       None),
        (alex_id,   "Car Service",            today + timedelta(days=3),  today + timedelta(days=3),  True,  None,       None),
        (alex_id,   "Work Conference Call",   today,                       today,                       False, "09:00:00","10:00:00"),
        (sam_id,    "Book Club",              today + timedelta(days=7),  today + timedelta(days=7),  True,  None,       None),
        (sam_id,    "Yoga Class",             today + timedelta(days=1),  today + timedelta(days=1),  False, "07:00:00","08:00:00"),
        (mia_id,    "Soccer Practice",        today + timedelta(days=1),  today + timedelta(days=1),  False, "16:00:00","17:30:00"),
        (mia_id,    "Soccer Practice",        today + timedelta(days=8),  today + timedelta(days=8),  False, "16:00:00","17:30:00"),
        (mia_id,    "School Bake Sale",       today + timedelta(days=4),  today + timedelta(days=4),  True,  None,       None),
        (family_id, "Weekend BBQ",            today + timedelta(days=9),  today + timedelta(days=9),  True,  None,       None),
        (alex_id,   "Date Night",             today + timedelta(days=6),  today + timedelta(days=6),  False, "19:00:00","22:00:00"),
    ]
    for i, (fid, title, start, end, all_day, st, et) in enumerate(events):
        start_str = f"{start}T{st}" if st else str(start)
        end_str   = f"{end}T{et}"   if et else str(end)
        conn.execute(text("""
            INSERT INTO calendar_events (uid, family_member_id, title, start_time, end_time, all_day)
            VALUES (:uid, :fid, :title, :start, :end, :all_day)
        """), {"uid": f"demo-event-{i}", "fid": fid,
               "title": title, "start": start_str, "end": end_str, "all_day": all_day})

    # ── Chores ──────────────────────────────────────────────────
    chores = [
        (alex_id, "Take out trash",      today,                       "FREQ=WEEKLY;BYDAY=MO"),
        (alex_id, "Mow the lawn",        today + timedelta(days=5),  None),
        (alex_id, "Grocery run",         today + timedelta(days=2),  None),
        (sam_id,  "Vacuum living room",  today,                       "FREQ=WEEKLY;BYDAY=SA"),
        (sam_id,  "Do laundry",          today + timedelta(days=1),  "FREQ=WEEKLY;BYDAY=TU"),
        (sam_id,  "Meal prep",           today + timedelta(days=3),  None),
        (mia_id,  "Clean bedroom",       today,                       "FREQ=WEEKLY;BYDAY=SU"),
        (mia_id,  "Unload dishwasher",  today + timedelta(days=1),  "FREQ=WEEKLY;BYDAY=MO,WE,FR"),
        (mia_id,  "Feed the dog",        today,                       "FREQ=DAILY"),
        (family_id,"Clean bathrooms",   today + timedelta(days=6),  "FREQ=WEEKLY;BYDAY=SA"),
    ]
    for fid, title, due, rrule in chores:
        conn.execute(text("""
            INSERT INTO chores (uid, family_member_id, title, due_date, completed, recurrence_rule)
            VALUES (:uid, :fid, :title, :due, 0, :rrule)
        """), {"uid": f"chore-{title.lower().replace(' ','-')}", "fid": fid,
               "title": title, "due": str(due), "rrule": rrule})

    # ── Shopping ─────────────────────────────────────────────────
    conn.execute(text("""
        INSERT INTO stores (name, is_default) VALUES ('Kroger', 1), ('Target', 0)
    """))
    conn.execute(text("""
        INSERT INTO departments (name) VALUES
          ('Produce'), ('Dairy'), ('Meat'), ('Bakery'),
          ('Frozen'), ('Pantry'), ('Beverages'), ('Household')
    """))

    store_id = conn.execute(text("SELECT id FROM stores WHERE name='Kroger'")).scalar()
    dept = {r[0]: r[1] for r in conn.execute(text("SELECT name, id FROM departments")).fetchall()}

    items = [
        ("Milk",           "Dairy",     1, "gallon"),
        ("Eggs",           "Dairy",     2, "dozen"),
        ("Bread",          "Bakery",    1, "loaf"),
        ("Bananas",        "Produce",   1, "bunch"),
        ("Chicken breast", "Meat",      2, "lb"),
        ("Pasta",          "Pantry",    2, "box"),
        ("Coffee",         "Beverages", 1, "bag"),
        ("Orange juice",   "Beverages", 1, "carton"),
        ("Apples",         "Produce",   6, "each"),
        ("Cheddar cheese", "Dairy",     1, "block"),
        ("Paper towels",   "Household", 1, "pack"),
    ]
    for desc, dept_name, qty, unit in items:
        conn.execute(text("""
            INSERT INTO shopping_items (description, store_id, department_id, quantity, unit, completed)
            VALUES (:desc, :sid, :did, :qty, :unit, 0)
        """), {"desc": desc, "sid": store_id, "did": dept[dept_name], "qty": qty, "unit": unit})

    # ── Meals ────────────────────────────────────────────────────
    meals_list = [
        ("Spaghetti Bolognese", "dinner", "Classic pasta with meat sauce", 30),
        ("Taco Tuesday",        "dinner", "Ground beef tacos with all the toppings", 20),
        ("Grilled Chicken",     "dinner", "Lemon herb grilled chicken with veggies", 35),
        ("Homemade Pizza",      "dinner", "Friday pizza night with favorite toppings", 45),
        ("Stir Fry",            "dinner", "Quick veggie and chicken stir fry with rice", 25),
        ("BBQ Burgers",         "dinner", "Weekend backyard burgers on the grill", 30),
        ("Chicken Soup",        "dinner", "Homemade chicken noodle soup", 60),
    ]
    for name, cat, desc, prep in meals_list:
        conn.execute(text("""
            INSERT INTO meals (name, category, description, prep_time)
            VALUES (:name, :cat, :desc, :prep)
        """), {"name": name, "cat": cat, "desc": desc, "prep": prep})

    # Plan the week ahead
    meal_ids = [r[0] for r in conn.execute(text("SELECT id FROM meals ORDER BY id")).fetchall()]
    for i, meal_id in enumerate(meal_ids):
        plan_date = today + timedelta(days=i)
        conn.execute(text("""
            INSERT INTO meal_plan (title, date, meal_id)
            VALUES (:title, :date, :mid)
        """), {"title": "", "date": str(plan_date), "mid": meal_id})

    # ── Budget ───────────────────────────────────────────────────
    month_id = today.strftime("%Y-%m")
    conn.execute(text("INSERT INTO budget_months (id) VALUES (:m)"), {"m": month_id})

    # Income
    income = [
        ("A", "Alex Paycheck",  15, 0, 2900.00),
        ("B", "Alex Paycheck",  30, 1, 2900.00),  # last of month
        ("C", "Sam Paycheck",    1, 0, 1800.00),
        ("D", "Sam Paycheck",   15, 0, 1800.00),
    ]
    for i, (ident, name, pay_day, pay_last, planned) in enumerate(income):
        conn.execute(text("""
            INSERT INTO budget_income (month_id, identifier, name, pay_day, pay_last_day, planned_amount, sort_order)
            VALUES (:m, :id, :name, :pd, :pl, :amt, :so)
        """), {"m": month_id, "id": ident, "name": name, "pd": pay_day,
               "pl": pay_last, "amt": planned, "so": i})

    # Expenses
    expenses = [
        ("needs", "Mortgage",        1,  0, 1650.00),
        ("needs", "Electric",        10, 0,  130.00),
        ("needs", "Water",           15, 0,   55.00),
        ("needs", "Internet",        20, 0,   65.00),
        ("needs", "Groceries",       0,  0,  500.00),
        ("needs", "Car Insurance",   5,  0,  185.00),
        ("needs", "Gas",             0,  0,  120.00),
        ("needs", "Health Insurance",1,  0,  320.00),
        ("wants", "Streaming (Netflix/Disney)", 12, 0, 35.00),
        ("wants", "Gym Membership",  1,  0,  45.00),
        ("wants", "Dining Out",      0,  0,  150.00),
        ("wants", "Kids Activities", 0,  0,   80.00),
    ]
    for i, (cat, name, due_day, due_last, planned) in enumerate(expenses):
        conn.execute(text("""
            INSERT INTO budget_expenses (month_id, category, name, due_day, due_last_day, planned_amount, sort_order)
            VALUES (:m, :cat, :name, :dd, :dl, :amt, :so)
        """), {"m": month_id, "cat": cat, "name": name, "dd": due_day,
               "dl": due_last, "amt": planned, "so": i})

    # Debts
    debts = [
        ("Car Loan",       5,  0, 285.00, 350.00),
        ("Student Loan",   15, 0, 210.00, 250.00),
    ]
    for i, (name, due_day, due_last, minimum, planned) in enumerate(debts):
        conn.execute(text("""
            INSERT INTO budget_debts (month_id, name, due_day, due_last_day, minimum_payment, planned_amount, sort_order)
            VALUES (:m, :name, :dd, :dl, :min, :amt, :so)
        """), {"m": month_id, "name": name, "dd": due_day, "dl": due_last,
               "min": minimum, "amt": planned, "so": i})

    # Savings envelopes
    envelopes = [
        ("Emergency Fund", 10000.00, 3200.00, 0),
        ("Vacation",        2000.00,   850.00, 1),
        ("New Car",        15000.00,  1100.00, 2),
        ("Home Repairs",    5000.00,   600.00, 3),
        ("Next Month",          0.0,     0.00, 4),
    ]
    for name, target, balance, sort in envelopes:
        conn.execute(text("""
            INSERT INTO savings_envelopes (name, target_amount, sort_order)
            VALUES (:name, :target, :sort)
        """), {"name": name, "target": target, "sort": sort})
        eid = conn.execute(text("SELECT id FROM savings_envelopes WHERE name=:n"), {"n": name}).scalar()
        if balance > 0:
            conn.execute(text("""
                INSERT INTO savings_transactions (envelope_id, tx_type, amount, date, note)
                VALUES (:eid, 'in', :amt, :d, 'Opening balance')
            """), {"eid": eid, "amt": balance, "d": str(today - timedelta(days=30))})

print(f"✓ Demo database created at {DB_PATH}")
print("  Family: Alex, Sam, Mia (+ Family group)")
print("  11 calendar events · 10 chores · 11 shopping items")
print("  7 meals planned · Budget set up for", month_id)
