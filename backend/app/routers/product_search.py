from __future__ import annotations
import json
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..config import settings

router = APIRouter()

STORES = ['Costco', 'HEB', 'Kroger', 'Walmart', 'Whole Foods']


class ProductSearchRequest(BaseModel):
    query: str


def _clean_prices(raw: dict | None) -> dict:
    if not isinstance(raw, dict):
        return {s: None for s in STORES}
    result = {}
    for store in STORES:
        val = raw.get(store)
        try:
            result[store] = float(val) if val is not None else None
        except (TypeError, ValueError):
            result[store] = None
    return result


@router.post("/product-search")
async def product_search(data: ProductSearchRequest):
    if not settings.gemini_api_key:
        raise HTTPException(503, "Gemini API key not configured")

    try:
        from google import genai
        from google.genai.types import GenerateContentConfig, GoogleSearch, Tool
    except ImportError:
        raise HTTPException(503, "google-genai package not installed")

    prompt = (
        f'Find US grocery store products matching: "{data.query}" '
        f'near zip code {settings.zip_code}.\n\n'
        "Rules:\n"
        "1. EXACT CATEGORY: Match only the precise product type — no substitutes.\n"
        "2. EXACT SIZE: If a size is specified, only include that exact size.\n"
        "3. MAINSTREAM: Products stocked at HEB, Kroger, Walmart, Costco, or Whole Foods.\n"
        "4. Return 4-6 results covering store brand, name brand, and organic tiers.\n\n"
        "For each product also find the current price at each of these stores: "
        "Costco, HEB, Kroger, Walmart, Whole Foods.\n\n"
        "Return ONLY a raw JSON array — no explanation, no markdown fences:\n"
        '[{"brand": "Brand or null", "description": "Product Name", "size": "size", '
        '"prices": {"Costco": 12.99, "HEB": 3.49, "Kroger": 3.79, "Walmart": 3.29, "Whole Foods": 4.99}}]\n\n'
        "Use null for any store that does not carry the product or whose price you cannot confirm."
    )

    system = (
        "You are a grocery product search and price assistant. "
        "Use Google Search to find real products and current prices at US grocery stores. "
        "Return ONLY a raw JSON array. Never include explanations, markdown, or code fences."
    )

    client = genai.Client(api_key=settings.gemini_api_key)
    response = await client.aio.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config=GenerateContentConfig(
            system_instruction=system,
            tools=[Tool(google_search=GoogleSearch())],
        ),
    )

    text = response.text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s*```\s*$", "", text, flags=re.MULTILINE)
    text = text.strip()

    try:
        products = json.loads(text)
        if not isinstance(products, list):
            raise ValueError("not a list")
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(502, "Could not parse product search results")

    return {
        "query": data.query,
        "products": [
            {
                "brand":       p.get("brand") or None,
                "description": p.get("description", ""),
                "size":        p.get("size") or None,
                "prices":      _clean_prices(p.get("prices")),
            }
            for p in products
            if isinstance(p, dict) and p.get("description")
        ],
    }
