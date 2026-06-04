import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .database import create_tables
from .routers import budget, calendar, chores, family, meals, routines, shopping, tracker

FRONTEND_DIST = Path(__file__).parent.parent.parent / "frontend" / "dist"

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    log.info("Bella demo started — iCloud sync disabled")
    yield


app = FastAPI(title="Bella", version="0.1.0", lifespan=lifespan)

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    os.getenv("FRONTEND_ORIGIN", ""),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o for o in ALLOWED_ORIGINS if o],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(family.router, prefix="/api/family", tags=["family"])
app.include_router(calendar.router, prefix="/api/calendar", tags=["calendar"])
app.include_router(chores.router, prefix="/api/chores", tags=["chores"])
app.include_router(tracker.router, prefix="/api/tracker", tags=["tracker"])
app.include_router(meals.router,   prefix="/api/meals",   tags=["meals"])
app.include_router(budget.router,  prefix="/api/budget",  tags=["budget"])
app.include_router(shopping.router,  prefix="/api/shopping",  tags=["shopping"])
app.include_router(routines.router,  prefix="/api/routines",  tags=["routines"])


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "Bella"}


# Serve the built React frontend — must be last so API routes take priority
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")
