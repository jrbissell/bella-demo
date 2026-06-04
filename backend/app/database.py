from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import settings

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    from . import models  # noqa: F401 — ensures models are registered
    Base.metadata.create_all(bind=engine)
    _migrate()


def _migrate():
    """Add columns introduced after initial schema creation, and seed static data."""
    from sqlalchemy import text
    migrations = [
        "ALTER TABLE family_members ADD COLUMN icloud_reminders_list VARCHAR",
        "ALTER TABLE family_members ADD COLUMN reminders_list_url VARCHAR",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:  # nosec B110
                pass  # column already exists

        # Seed tracker with the one known open bug if the table is empty
        try:
            count = conn.execute(text("SELECT COUNT(*) FROM tracker_items")).scalar()
            if count == 0:
                seed_sql = (
                    "INSERT INTO tracker_items"  # nosec B608 - hardcoded seed data, no user input
                    " (item_type, title, description, status, priority, created_at, updated_at)"
                    " VALUES ('bug',"
                    " 'Month view: day columns are not equal width',"
                    " 'All 7 day columns should be the same fixed width."
                    " Layout currently shifts depending on event content density.',"
                    " 'open', 5, datetime('now'), datetime('now'))"
                )
                conn.execute(text(seed_sql))
                conn.commit()
        except Exception:  # nosec B110
            pass
