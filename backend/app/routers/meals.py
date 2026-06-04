from __future__ import annotations
import asyncio
import datetime
import json
import re
from typing import Optional

import anthropic
import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..config import settings
from ..database import get_db
from ..models import Meal, MealPlan, Recipe
from ..schemas import (
    Meal as MealSchema, MealCreate, MealUpdate,
    MealPlan as MealPlanSchema, MealPlanCreate, MealPlanUpdate,
    Recipe as RecipeSchema, RecipeCreate, RecipeUpdate,
)

router = APIRouter()


# ── helpers ───────────────────────────────────────────────────────────────────

def _recipe_out(r: Recipe) -> dict:
    return RecipeSchema.model_validate(r).model_dump()

def _meal_out(m: Meal) -> dict:
    d = MealSchema.model_validate(m).model_dump()
    d["recipe_name"] = m.recipe.name if m.recipe else None
    return d


# ── recipes ───────────────────────────────────────────────────────────────────

@router.get("/recipes/")
def list_recipes(db: Session = Depends(get_db)):
    return [_recipe_out(r) for r in db.query(Recipe).order_by(Recipe.name).all()]

@router.post("/recipes/", status_code=201)
def create_recipe(data: RecipeCreate, db: Session = Depends(get_db)):
    recipe = Recipe(**data.model_dump(), created_at=datetime.datetime.utcnow())
    db.add(recipe); db.commit(); db.refresh(recipe)
    return _recipe_out(recipe)

@router.get("/recipes/{recipe_id}")
def get_recipe(recipe_id: int, db: Session = Depends(get_db)):
    r = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not r: raise HTTPException(404, "Recipe not found")
    return _recipe_out(r)

@router.patch("/recipes/{recipe_id}")
def update_recipe(recipe_id: int, data: RecipeUpdate, db: Session = Depends(get_db)):
    r = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not r: raise HTTPException(404, "Recipe not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(r, k, v)
    db.commit(); db.refresh(r)
    return _recipe_out(r)

@router.delete("/recipes/{recipe_id}", status_code=204)
def delete_recipe(recipe_id: int, db: Session = Depends(get_db)):
    r = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not r: raise HTTPException(404, "Recipe not found")
    db.delete(r); db.commit()


# ── recipe import ─────────────────────────────────────────────────────────────

class ImportRequest(BaseModel):
    url: str

def _parse_jsonld(html: str) -> dict | None:
    """Try to extract Recipe data from JSON-LD embedded in the page."""

    def _n(x):
        if x is None: return None
        try: return round(float(re.sub(r'[^\d.]', '', str(x))), 1)
        except: return None

    def _str(x): return str(x).strip() if x else None

    def _yield(x):
        if not x: return None
        if isinstance(x, list): x = x[0]
        try: return int(str(x).strip().split()[0])
        except: return None

    for m in re.finditer(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.DOTALL | re.IGNORECASE):
        try:
            data = json.loads(m.group(1))
            # Handle top-level array or @graph
            if isinstance(data, list):
                data = next((x for x in data if "Recipe" in str(x.get("@type", ""))), None)
            elif isinstance(data, dict) and data.get("@graph"):
                data = next((x for x in data["@graph"] if "Recipe" in str(x.get("@type", ""))), None)
            if not data or "Recipe" not in str(data.get("@type", "")):
                continue

            nutrition = data.get("nutrition") or {}
            ings      = data.get("recipeIngredient", [])

            raw_steps = data.get("recipeInstructions", [])
            steps = []
            for s in raw_steps:
                if isinstance(s, str):   steps.append(s)
                elif isinstance(s, dict): steps.append(s.get("text") or s.get("name") or "")
                elif isinstance(s, list):
                    for sub in s:
                        if isinstance(sub, dict): steps.append(sub.get("text") or "")
            steps = [s.strip() for s in steps if s.strip()]

            return {
                "name":         _str(data.get("name") or data.get("headline")),
                "description":  _str(data.get("description")),
                "servings":     _yield(data.get("recipeYield")),
                "serving_size": _str(data.get("servingSize") or nutrition.get("servingSize")),
                "calories":     _n(nutrition.get("calories")),
                "protein_g":    _n(nutrition.get("proteinContent")),
                "carbs_g":      _n(nutrition.get("carbohydrateContent")),
                "fat_g":        _n(nutrition.get("fatContent")),
                "ingredients":  json.dumps(ings),
                "instructions": json.dumps(steps),
            }
        except Exception:  # nosec B112
            continue
    return None


async def _parse_with_claude(html: str, url: str) -> dict:
    """Fall back to Claude to extract recipe data from page HTML."""
    # Strip tags, keep text (rough)
    text = re.sub(r'<[^>]+>', ' ', html)
    text = re.sub(r'\s+', ' ', text).strip()[:12000]

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": (
                f"Extract the recipe from this webpage text. Source URL: {url}\n\n"
                f"{text}\n\n"
                "Return ONLY valid JSON (no markdown) with these exact keys:\n"
                '{"name":"","description":"","servings":null,"serving_size":"","calories":null,'
                '"protein_g":null,"carbs_g":null,"fat_g":null,'
                '"ingredients":["..."],"instructions":["..."]}'
            ),
        }],
    )
    raw = msg.content[0].text.strip()
    if raw.startswith("```"): raw = raw.split("\n",1)[1].rsplit("```",1)[0].strip()
    data = json.loads(raw)
    # Stringify lists for storage
    if isinstance(data.get("ingredients"), list):
        data["ingredients"] = json.dumps(data["ingredients"])
    if isinstance(data.get("instructions"), list):
        data["instructions"] = json.dumps(data["instructions"])
    return data


def _fetch_with_selenium(url: str) -> str:
    """Fetch page HTML using SeleniumBase UC mode — bypasses bot detection."""
    from seleniumbase import SB
    with SB(uc=True, headless=True, binary_location="/usr/bin/chromium") as sb:
        sb.open(url)
        sb.sleep(3)
        return sb.get_page_source()


@router.post("/recipes/import")
async def import_recipe(req: ImportRequest):
    """Fetch a recipe URL and parse it. Returns preview data — not saved yet."""
    html = None

    # 1. Fast path: plain httpx (works for most sites)
    try:
        async with httpx.AsyncClient(
            timeout=15,
            follow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                              "(KHTML, like Gecko) Chrome/124.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            },
        ) as client:
            resp = await client.get(req.url)
            if resp.status_code < 400:
                html = resp.text
    except Exception:  # nosec B110
        pass

    # 2. Fallback: Selenium (bypasses Cloudflare / bot-detection)
    if not html:
        try:
            html = await asyncio.to_thread(_fetch_with_selenium, req.url)
        except Exception as e:
            raise HTTPException(400, f"Could not fetch URL even with browser fallback: {e}")

    # 3. Parse JSON-LD first (fast, no AI cost)
    parsed = _parse_jsonld(html)

    # 4. Fall back to Claude
    if not parsed or not parsed.get("name"):
        if not settings.anthropic_api_key:
            raise HTTPException(422, "No JSON-LD found and no Anthropic key configured")
        parsed = await _parse_with_claude(html, req.url)

    parsed["source_url"] = req.url
    return parsed


# ── saved meals ───────────────────────────────────────────────────────────────

@router.get("/")
def list_meals(db: Session = Depends(get_db)):
    return [_meal_out(m) for m in db.query(Meal).order_by(Meal.name).all()]

@router.post("/", status_code=201)
def create_meal(data: MealCreate, db: Session = Depends(get_db)):
    meal = Meal(**data.model_dump(), created_at=datetime.datetime.utcnow())
    db.add(meal); db.commit(); db.refresh(meal)
    return _meal_out(meal)

@router.patch("/{meal_id}")
def update_meal(meal_id: int, data: MealUpdate, db: Session = Depends(get_db)):
    meal = db.query(Meal).filter(Meal.id == meal_id).first()
    if not meal: raise HTTPException(404, "Meal not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(meal, k, v)
    db.commit(); db.refresh(meal)
    return _meal_out(meal)

@router.delete("/{meal_id}", status_code=204)
def delete_meal(meal_id: int, db: Session = Depends(get_db)):
    meal = db.query(Meal).filter(Meal.id == meal_id).first()
    if not meal: raise HTTPException(404, "Meal not found")
    db.delete(meal); db.commit()


# ── meal plan ─────────────────────────────────────────────────────────────────

@router.get("/plan/")
def list_plan(db: Session = Depends(get_db)):
    return [MealPlanSchema.model_validate(e).model_dump() for e in db.query(MealPlan).order_by(MealPlan.date).all()]

@router.post("/plan/", status_code=201)
def create_plan(data: MealPlanCreate, db: Session = Depends(get_db)):
    entry = MealPlan(**data.model_dump(), created_at=datetime.datetime.utcnow())
    db.add(entry); db.commit(); db.refresh(entry)
    return MealPlanSchema.model_validate(entry).model_dump()

@router.patch("/plan/{entry_id}")
def update_plan(entry_id: int, data: MealPlanUpdate, db: Session = Depends(get_db)):
    entry = db.query(MealPlan).filter(MealPlan.id == entry_id).first()
    if not entry: raise HTTPException(404, "Plan entry not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(entry, k, v)
    db.commit(); db.refresh(entry)
    return MealPlanSchema.model_validate(entry).model_dump()

@router.delete("/plan/{entry_id}", status_code=204)
def delete_plan(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(MealPlan).filter(MealPlan.id == entry_id).first()
    if not entry: raise HTTPException(404, "Plan entry not found")
    db.delete(entry); db.commit()
