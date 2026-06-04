from fastapi import APIRouter
from ..schemas import SyncStatus
from ..services.sync_service import sync_all_calendars
from ..services.caldav_service import get_calendars
from ..config import settings

router = APIRouter()


@router.post("/", response_model=SyncStatus)
def trigger_sync():
    """Manually trigger a full iCloud → SQLite calendar sync."""
    result = sync_all_calendars()
    return SyncStatus(**result)


@router.get("/status")
def sync_status():
    return {
        "icloud_configured": bool(settings.icloud_username and settings.icloud_password),
        "sync_interval_minutes": settings.sync_interval_minutes,
    }


@router.get("/calendars")
def list_icloud_calendars():
    """List all calendars on the iCloud account (useful when adding a family member)."""
    if not settings.icloud_username:
        return {"calendars": [], "error": "iCloud not configured"}
    try:
        cals = get_calendars()
        return {"calendars": cals}
    except Exception as exc:
        return {"calendars": [], "error": str(exc)}
