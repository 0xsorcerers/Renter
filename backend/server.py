from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, UploadFile, File, Query
from fastapi.responses import Response
from fastapi.concurrency import run_in_threadpool
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Literal
from datetime import datetime, timedelta, timezone
from pathlib import Path
import os
import uuid
import logging
import bcrypt
import jwt
import httpx
import requests

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("renter")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALG = "HS256"
JWT_DAYS = 30
GOOGLE_MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY", "")
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
APP_NAME = "renter"
EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"

app = FastAPI(title="Renter API")
api = APIRouter(prefix="/api")


def now() -> datetime:
    return datetime.now(timezone.utc)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


# ---------------------------------------------------------------------------
# Currency mapping (country code -> currency)
# ---------------------------------------------------------------------------
CURRENCIES = {
    "NGN": {"code": "NGN", "symbol": "₦", "name": "Nigerian Naira"},
    "CNY": {"code": "CNY", "symbol": "¥", "name": "Chinese Yuan"},
    "USD": {"code": "USD", "symbol": "$", "name": "US Dollar"},
    "EUR": {"code": "EUR", "symbol": "€", "name": "Euro"},
    "GBP": {"code": "GBP", "symbol": "£", "name": "British Pound"},
    "INR": {"code": "INR", "symbol": "₹", "name": "Indian Rupee"},
    "JPY": {"code": "JPY", "symbol": "¥", "name": "Japanese Yen"},
    "KRW": {"code": "KRW", "symbol": "₩", "name": "South Korean Won"},
    "GHS": {"code": "GHS", "symbol": "₵", "name": "Ghanaian Cedi"},
    "KES": {"code": "KES", "symbol": "KSh", "name": "Kenyan Shilling"},
    "ZAR": {"code": "ZAR", "symbol": "R", "name": "South African Rand"},
    "EGP": {"code": "EGP", "symbol": "E£", "name": "Egyptian Pound"},
    "CAD": {"code": "CAD", "symbol": "C$", "name": "Canadian Dollar"},
    "AUD": {"code": "AUD", "symbol": "A$", "name": "Australian Dollar"},
    "NZD": {"code": "NZD", "symbol": "NZ$", "name": "New Zealand Dollar"},
    "BRL": {"code": "BRL", "symbol": "R$", "name": "Brazilian Real"},
    "MXN": {"code": "MXN", "symbol": "MX$", "name": "Mexican Peso"},
    "ARS": {"code": "ARS", "symbol": "AR$", "name": "Argentine Peso"},
    "AED": {"code": "AED", "symbol": "د.إ", "name": "UAE Dirham"},
    "SAR": {"code": "SAR", "symbol": "﷼", "name": "Saudi Riyal"},
    "TRY": {"code": "TRY", "symbol": "₺", "name": "Turkish Lira"},
    "RUB": {"code": "RUB", "symbol": "₽", "name": "Russian Ruble"},
    "CHF": {"code": "CHF", "symbol": "CHF", "name": "Swiss Franc"},
    "SEK": {"code": "SEK", "symbol": "kr", "name": "Swedish Krona"},
    "NOK": {"code": "NOK", "symbol": "kr", "name": "Norwegian Krone"},
    "DKK": {"code": "DKK", "symbol": "kr", "name": "Danish Krone"},
    "PLN": {"code": "PLN", "symbol": "zł", "name": "Polish Zloty"},
    "PHP": {"code": "PHP", "symbol": "₱", "name": "Philippine Peso"},
    "IDR": {"code": "IDR", "symbol": "Rp", "name": "Indonesian Rupiah"},
    "MYR": {"code": "MYR", "symbol": "RM", "name": "Malaysian Ringgit"},
    "SGD": {"code": "SGD", "symbol": "S$", "name": "Singapore Dollar"},
    "THB": {"code": "THB", "symbol": "฿", "name": "Thai Baht"},
    "VND": {"code": "VND", "symbol": "₫", "name": "Vietnamese Dong"},
    "PKR": {"code": "PKR", "symbol": "₨", "name": "Pakistani Rupee"},
    "BDT": {"code": "BDT", "symbol": "৳", "name": "Bangladeshi Taka"},
    "HKD": {"code": "HKD", "symbol": "HK$", "name": "Hong Kong Dollar"},
    "TWD": {"code": "TWD", "symbol": "NT$", "name": "Taiwan Dollar"},
    "ILS": {"code": "ILS", "symbol": "₪", "name": "Israeli Shekel"},
    "MAD": {"code": "MAD", "symbol": "MAD", "name": "Moroccan Dirham"},
    "TZS": {"code": "TZS", "symbol": "TSh", "name": "Tanzanian Shilling"},
    "UGX": {"code": "UGX", "symbol": "USh", "name": "Ugandan Shilling"},
    "ETB": {"code": "ETB", "symbol": "Br", "name": "Ethiopian Birr"},
    "XOF": {"code": "XOF", "symbol": "CFA", "name": "West African CFA Franc"},
    "XAF": {"code": "XAF", "symbol": "FCFA", "name": "Central African CFA Franc"},
    "RWF": {"code": "RWF", "symbol": "FRw", "name": "Rwandan Franc"},
    "COP": {"code": "COP", "symbol": "COL$", "name": "Colombian Peso"},
    "CLP": {"code": "CLP", "symbol": "CLP$", "name": "Chilean Peso"},
    "PEN": {"code": "PEN", "symbol": "S/", "name": "Peruvian Sol"},
    "CZK": {"code": "CZK", "symbol": "Kč", "name": "Czech Koruna"},
    "HUF": {"code": "HUF", "symbol": "Ft", "name": "Hungarian Forint"},
    "RON": {"code": "RON", "symbol": "lei", "name": "Romanian Leu"},
    "UAH": {"code": "UAH", "symbol": "₴", "name": "Ukrainian Hryvnia"},
    "QAR": {"code": "QAR", "symbol": "﷼", "name": "Qatari Riyal"},
    "KWD": {"code": "KWD", "symbol": "KD", "name": "Kuwaiti Dinar"},
    "JMD": {"code": "JMD", "symbol": "J$", "name": "Jamaican Dollar"},
}

COUNTRY_TO_CURRENCY = {
    "NG": "NGN", "CN": "CNY", "US": "USD", "GB": "GBP", "IN": "INR", "JP": "JPY", "KR": "KRW",
    "GH": "GHS", "KE": "KES", "ZA": "ZAR", "EG": "EGP", "CA": "CAD", "AU": "AUD", "NZ": "NZD",
    "BR": "BRL", "MX": "MXN", "AR": "ARS", "AE": "AED", "SA": "SAR", "TR": "TRY", "RU": "RUB",
    "CH": "CHF", "SE": "SEK", "NO": "NOK", "DK": "DKK", "PL": "PLN", "PH": "PHP", "ID": "IDR",
    "MY": "MYR", "SG": "SGD", "TH": "THB", "VN": "VND", "PK": "PKR", "BD": "BDT", "HK": "HKD",
    "TW": "TWD", "IL": "ILS", "MA": "MAD", "TZ": "TZS", "UG": "UGX", "ET": "ETB", "RW": "RWF",
    "CO": "COP", "CL": "CLP", "PE": "PEN", "CZ": "CZK", "HU": "HUF", "RO": "RON", "UA": "UAH",
    "QA": "QAR", "KW": "KWD", "JM": "JMD", "EC": "USD", "PR": "USD", "PA": "USD",
    "SN": "XOF", "CI": "XOF", "ML": "XOF", "BF": "XOF", "BJ": "XOF", "TG": "XOF", "NE": "XOF",
    "CM": "XAF", "GA": "XAF", "TD": "XAF", "CG": "XAF", "CF": "XAF", "GQ": "XAF",
}
for _cc in ["DE", "FR", "ES", "IT", "NL", "BE", "AT", "PT", "IE", "FI", "GR", "LU", "SK", "SI", "EE", "LV", "LT", "CY", "MT", "HR"]:
    COUNTRY_TO_CURRENCY[_cc] = "EUR"


def currency_for_country(cc: Optional[str]) -> dict:
    code = COUNTRY_TO_CURRENCY.get((cc or "").upper(), "USD")
    return CURRENCIES[code]


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
Role = Literal["homeowner", "tenant"]
Period = Literal["week", "month", "year"]


class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)
    name: str = Field(min_length=1, max_length=80)
    role: Role
    phone: Optional[str] = ""
    whatsapp: Optional[str] = ""


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class SessionBody(BaseModel):
    session_id: str


class UpdateProfileBody(BaseModel):
    name: Optional[str] = None
    role: Optional[Role] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    whatsapp: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    picture: Optional[str] = None


class ListingCreate(BaseModel):
    title: str = Field(min_length=3, max_length=120)
    description: str = Field(default="", max_length=3000)
    address: str
    city: Optional[str] = ""
    country: Optional[str] = ""
    country_code: Optional[str] = ""
    lat: float
    lng: float
    price: float = Field(gt=0)
    currency: Optional[str] = None
    period: Period
    property_type: str = "apartment"
    bedrooms: int = 1
    bathrooms: int = 1
    photos: List[str] = []


class OfferCreate(BaseModel):
    amount: float = Field(gt=0)
    message: str = Field(default="", max_length=500)


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    text: str = Field(min_length=1, max_length=1500)


class ReplyCreate(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
PUBLIC_USER_FIELDS = {"_id": 0, "password_hash": 0}


def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode("utf-8"), h.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def make_jwt(user_id: str) -> str:
    n = now()
    return jwt.encode({"sub": user_id, "iat": n, "exp": n + timedelta(days=JWT_DAYS)}, JWT_SECRET, algorithm=JWT_ALG)


async def get_user(user_id: str) -> Optional[dict]:
    return await db.users.find_one({"user_id": user_id}, PUBLIC_USER_FIELDS)


async def resolve_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        return await get_user(payload["sub"])
    except Exception:
        pass
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    exp = session["expires_at"]
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now():
        return None
    return await get_user(session["user_id"])


async def optional_user(request: Request) -> Optional[dict]:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    return await resolve_token(auth[7:].strip())


async def current_user(request: Request) -> dict:
    user = await optional_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def user_summary(u: Optional[dict]) -> Optional[dict]:
    if not u:
        return None
    return {k: u.get(k) for k in ["user_id", "name", "role", "picture", "phone", "whatsapp", "bio", "city", "country"]}


# ---------------------------------------------------------------------------
# Object storage
# ---------------------------------------------------------------------------
storage_key: Optional[str] = None


def init_storage():
    global storage_key
    if storage_key:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    if resp.status_code == 503:
        globals()["storage_key"] = None
        key = init_storage()
        resp = requests.put(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key, "Content-Type": content_type}, data=data, timeout=120)
    if resp.status_code == 402:
        raise HTTPException(status_code=402, detail="Storage credits exhausted")
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api.post("/auth/register")
async def register(body: RegisterBody):
    email = body.email.strip().lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="An account with that email already exists")
    user = {
        "user_id": new_id("user"),
        "email": email,
        "name": body.name.strip(),
        "role": body.role,
        "phone": body.phone or "",
        "whatsapp": body.whatsapp or "",
        "bio": "",
        "picture": "",
        "city": "",
        "country": "",
        "auth_provider": "password",
        "password_hash": hash_password(body.password),
        "created_at": now(),
    }
    await db.users.insert_one(user)
    return {"token": make_jwt(user["user_id"]), "user": await get_user(user["user_id"])}


@api.post("/auth/login")
async def login(body: LoginBody):
    email = body.email.strip().lower()
    user = await db.users.find_one({"email": email})
    if not user or not user.get("password_hash") or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return {"token": make_jwt(user["user_id"]), "user": await get_user(user["user_id"])}


@api.post("/auth/session")
async def exchange_session(body: SessionBody):
    async with httpx.AsyncClient(timeout=20) as hc:
        resp = await hc.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": body.session_id})
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    data = resp.json()
    email = (data.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=401, detail="No email returned")
    existing = await db.users.find_one({"email": email})
    if existing:
        user_id = existing["user_id"]
        updates = {}
        if not existing.get("picture") and data.get("picture"):
            updates["picture"] = data["picture"]
        if updates:
            await db.users.update_one({"user_id": user_id}, {"$set": updates})
    else:
        user_id = new_id("user")
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": data.get("name") or email.split("@")[0],
            "role": None,
            "phone": "",
            "whatsapp": "",
            "bio": "",
            "picture": data.get("picture") or "",
            "city": "",
            "country": "",
            "auth_provider": "google",
            "created_at": now(),
        })
    session_token = data["session_token"]
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "expires_at": now() + timedelta(days=7),
        "created_at": now(),
    })
    return {"session_token": session_token, "token": session_token, "user": await get_user(user_id)}


@api.get("/auth/me")
async def me(user: dict = Depends(current_user)):
    return user


@api.post("/auth/logout")
async def logout(request: Request, user: dict = Depends(current_user)):
    token = request.headers.get("Authorization", "")[7:].strip()
    await db.user_sessions.delete_many({"session_token": token})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
@api.put("/users/me")
async def update_me(body: UpdateProfileBody, user: dict = Depends(current_user)):
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if updates:
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": updates})
    return await get_user(user["user_id"])


@api.get("/users/{user_id}")
async def public_profile(user_id: str):
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0, "email": 0})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    listings_count = await db.listings.count_documents({"owner_id": user_id, "deleted_at": None})
    reviews = await db.reviews.find({"owner_id": user_id, "deleted_at": None}, {"_id": 0, "rating": 1}).to_list(1000)
    avg = round(sum(r["rating"] for r in reviews) / len(reviews), 1) if reviews else None
    u["stats"] = {"listings": listings_count, "reviews": len(reviews), "rating": avg}
    return u


# ---------------------------------------------------------------------------
# Currencies & places
# ---------------------------------------------------------------------------
@api.get("/currencies")
async def list_currencies():
    return sorted(CURRENCIES.values(), key=lambda c: c["name"])


@api.get("/currencies/detect")
async def detect_currency(country_code: str = Query("")):
    return currency_for_country(country_code)


def _google_place_search(q: str) -> List[dict]:
    if not GOOGLE_MAPS_API_KEY:
        return []
    r = requests.get(
        "https://maps.googleapis.com/maps/api/place/textsearch/json",
        params={"query": q, "key": GOOGLE_MAPS_API_KEY},
        timeout=10,
    )
    data = r.json()
    if data.get("status") != "OK":
        raise RuntimeError(data.get("status"))
    out = []
    for p in data.get("results", [])[:6]:
        loc = p["geometry"]["location"]
        out.append({
            "description": p.get("formatted_address") or p.get("name"),
            "name": p.get("name"),
            "lat": loc["lat"],
            "lng": loc["lng"],
            "country_code": "",
            "country": "",
            "city": "",
            "source": "google",
        })
    return out


def _photon_search(q: str) -> List[dict]:
    r = requests.get("https://photon.komoot.io/api/", params={"q": q, "limit": 6}, timeout=10, headers={"User-Agent": "RenterApp/1.0"})
    r.raise_for_status()
    out = []
    for f in r.json().get("features", []):
        p = f.get("properties", {})
        coords = f.get("geometry", {}).get("coordinates", [0, 0])
        parts = [p.get("name"), p.get("street"), p.get("district"), p.get("city"), p.get("state"), p.get("country")]
        desc = ", ".join([x for x in parts if x])
        out.append({
            "description": desc,
            "name": p.get("name") or desc,
            "lat": coords[1],
            "lng": coords[0],
            "country_code": (p.get("countrycode") or "").upper(),
            "country": p.get("country") or "",
            "city": p.get("city") or p.get("state") or p.get("district") or "",
            "source": "osm",
        })
    return out


def _search_places(q: str) -> List[dict]:
    try:
        results = _google_place_search(q)
        if results:
            return results
    except Exception as e:
        logger.info(f"Google places unavailable ({e}); using OSM fallback")
    try:
        return _photon_search(q)
    except Exception as e:
        logger.warning(f"Photon search failed: {e}")
        return []


@api.get("/places/search")
async def search_places(q: str = Query(min_length=2)):
    results = await run_in_threadpool(_search_places, q)
    for r in results:
        r["currency"] = currency_for_country(r.get("country_code")) if r.get("country_code") else None
    return results


# ---------------------------------------------------------------------------
# Uploads
# ---------------------------------------------------------------------------
@api.post("/upload")
async def upload(file: UploadFile = File(...), user: dict = Depends(current_user)):
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image too large (max 8MB)")
    ext = (file.filename or "img.jpg").rsplit(".", 1)[-1].lower()
    if ext not in {"jpg", "jpeg", "png", "webp", "heic", "gif"}:
        ext = "jpg"
    path = f"{APP_NAME}/uploads/{user['user_id']}/{uuid.uuid4().hex}.{ext}"
    content_type = file.content_type or "image/jpeg"
    result = await run_in_threadpool(put_object, path, data, content_type)
    await db.files.insert_one({
        "file_id": new_id("file"),
        "owner_id": user["user_id"],
        "storage_path": result["path"],
        "content_type": content_type,
        "size": len(data),
        "created_at": now(),
        "deleted_at": None,
    })
    return {"path": result["path"], "url": f"/api/files/{result['path']}"}


@api.get("/files/{path:path}")
async def serve_file(path: str):
    rec = await db.files.find_one({"storage_path": path, "deleted_at": None}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=404, detail="File not found")
    try:
        content, ctype = await run_in_threadpool(get_object, path)
    except Exception:
        raise HTTPException(status_code=404, detail="File unavailable")
    return Response(content=content, media_type=ctype, headers={"Cache-Control": "public, max-age=86400"})


# ---------------------------------------------------------------------------
# Listings
# ---------------------------------------------------------------------------
def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    from math import radians, sin, cos, asin, sqrt
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 6371 * 2 * asin(sqrt(a))


async def decorate_listing(doc: dict, viewer: Optional[dict] = None) -> dict:
    owner = await get_user(doc["owner_id"])
    doc["owner"] = user_summary(owner)
    doc["offers_count"] = await db.offers.count_documents({"listing_id": doc["listing_id"], "deleted_at": None})
    reviews = await db.reviews.find({"listing_id": doc["listing_id"], "deleted_at": None}, {"_id": 0, "rating": 1}).to_list(500)
    doc["reviews_count"] = len(reviews)
    doc["rating"] = round(sum(r["rating"] for r in reviews) / len(reviews), 1) if reviews else None
    doc["is_mine"] = bool(viewer and viewer["user_id"] == doc["owner_id"])
    doc["is_favorited"] = bool(
        viewer and await db.favorites.find_one({"user_id": viewer["user_id"], "listing_id": doc["listing_id"], "deleted_at": None})
    )
    doc.setdefault("distance_km", None)
    return doc


@api.post("/listings")
async def create_listing(body: ListingCreate, user: dict = Depends(current_user)):
    if user.get("role") != "homeowner":
        raise HTTPException(status_code=403, detail="Only homeowners can post listings")
    cur = CURRENCIES.get((body.currency or "").upper()) or currency_for_country(body.country_code)
    doc = body.model_dump()
    doc.update({
        "listing_id": new_id("lst"),
        "owner_id": user["user_id"],
        "currency": cur["code"],
        "currency_symbol": cur["symbol"],
        "created_at": now(),
        "deleted_at": None,
    })
    await db.listings.insert_one(doc)
    doc.pop("_id", None)
    return await decorate_listing(doc, user)


@api.get("/listings")
async def list_listings(
    q: str = Query(""),
    period: str = Query(""),
    mine: bool = Query(False),
    owner_id: str = Query(""),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    bedrooms: Optional[int] = Query(None),
    property_type: str = Query(""),
    lat: Optional[float] = Query(None),
    lng: Optional[float] = Query(None),
    radius_km: float = Query(25),
    viewer: Optional[dict] = Depends(optional_user),
):
    filt: dict = {"deleted_at": None}
    if min_price is not None or max_price is not None:
        price_f: dict = {}
        if min_price is not None:
            price_f["$gte"] = min_price
        if max_price is not None:
            price_f["$lte"] = max_price
        filt["price"] = price_f
    if bedrooms:
        filt["bedrooms"] = {"$gte": bedrooms}
    if property_type:
        filt["property_type"] = property_type
    if q:
        filt["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"city": {"$regex": q, "$options": "i"}},
            {"country": {"$regex": q, "$options": "i"}},
            {"address": {"$regex": q, "$options": "i"}},
        ]
    if period in ("week", "month", "year"):
        filt["period"] = period
    if mine:
        if not viewer:
            raise HTTPException(status_code=401, detail="Not authenticated")
        filt["owner_id"] = viewer["user_id"]
    if owner_id:
        filt["owner_id"] = owner_id
    docs = await db.listings.find(filt, {"_id": 0}).sort("created_at", -1).to_list(500)
    if lat is not None and lng is not None:
        near = []
        for d in docs:
            dist = haversine_km(lat, lng, d["lat"], d["lng"])
            if dist <= radius_km:
                d["distance_km"] = round(dist, 1)
                near.append(d)
        docs = sorted(near, key=lambda d: d["distance_km"])
    return [await decorate_listing(d, viewer) for d in docs[:200]]


# ---------------------------------------------------------------------------
# Favorites
# ---------------------------------------------------------------------------
@api.post("/listings/{listing_id}/favorite")
async def toggle_favorite(listing_id: str, user: dict = Depends(current_user)):
    if not await db.listings.find_one({"listing_id": listing_id, "deleted_at": None}, {"_id": 0, "listing_id": 1}):
        raise HTTPException(status_code=404, detail="Listing not found")
    existing = await db.favorites.find_one({"user_id": user["user_id"], "listing_id": listing_id})
    if existing and existing.get("deleted_at") is None:
        await db.favorites.update_one({"_id": existing["_id"]}, {"$set": {"deleted_at": now()}})
        return {"favorited": False}
    if existing:
        await db.favorites.update_one({"_id": existing["_id"]}, {"$set": {"deleted_at": None, "created_at": now()}})
    else:
        await db.favorites.insert_one({"user_id": user["user_id"], "listing_id": listing_id, "created_at": now(), "deleted_at": None})
    return {"favorited": True}


@api.get("/favorites")
async def my_favorites(user: dict = Depends(current_user)):
    favs = await db.favorites.find({"user_id": user["user_id"], "deleted_at": None}, {"_id": 0}).sort("created_at", -1).to_list(500)
    out = []
    for f in favs:
        doc = await db.listings.find_one({"listing_id": f["listing_id"], "deleted_at": None}, {"_id": 0})
        if doc:
            out.append(await decorate_listing(doc, user))
    return out


@api.get("/listings/{listing_id}")
async def get_listing(listing_id: str, viewer: Optional[dict] = Depends(optional_user)):
    doc = await db.listings.find_one({"listing_id": listing_id, "deleted_at": None}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Listing not found")
    return await decorate_listing(doc, viewer)


@api.delete("/listings/{listing_id}")
async def delete_listing(listing_id: str, user: dict = Depends(current_user)):
    res = await db.listings.update_one({"listing_id": listing_id, "owner_id": user["user_id"]}, {"$set": {"deleted_at": now()}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Listing not found")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Offers
# ---------------------------------------------------------------------------
OfferStatus = Literal["pending", "accepted", "declined"]


class OfferStatusBody(BaseModel):
    status: OfferStatus


async def decorate_offer(o: dict) -> dict:
    o["tenant"] = user_summary(await get_user(o["tenant_id"]))
    o.setdefault("status", "pending")
    return o


@api.patch("/offers/{offer_id}")
async def respond_offer(offer_id: str, body: OfferStatusBody, user: dict = Depends(current_user)):
    offer = await db.offers.find_one({"offer_id": offer_id, "deleted_at": None}, {"_id": 0})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    if offer["owner_id"] != user["user_id"]:
        raise HTTPException(status_code=403, detail="Only the homeowner can respond to offers")
    await db.offers.update_one({"offer_id": offer_id}, {"$set": {"status": body.status, "responded_at": now()}})
    offer["status"] = body.status
    return await decorate_offer(offer)


@api.post("/listings/{listing_id}/offers")
async def create_offer(listing_id: str, body: OfferCreate, user: dict = Depends(current_user)):
    if user.get("role") != "tenant":
        raise HTTPException(status_code=403, detail="Only tenants can make offers")
    listing = await db.listings.find_one({"listing_id": listing_id, "deleted_at": None}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    offer = {
        "offer_id": new_id("off"),
        "listing_id": listing_id,
        "tenant_id": user["user_id"],
        "owner_id": listing["owner_id"],
        "amount": body.amount,
        "currency": listing["currency"],
        "currency_symbol": listing["currency_symbol"],
        "period": listing["period"],
        "message": body.message,
        "status": "pending",
        "created_at": now(),
        "deleted_at": None,
    }
    await db.offers.insert_one(offer)
    offer.pop("_id", None)
    return await decorate_offer(offer)


@api.get("/listings/{listing_id}/offers")
async def list_offers(listing_id: str):
    docs = await db.offers.find({"listing_id": listing_id, "deleted_at": None}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [await decorate_offer(o) for o in docs]


@api.get("/offers/mine")
async def my_offers(user: dict = Depends(current_user)):
    docs = await db.offers.find({"tenant_id": user["user_id"], "deleted_at": None}, {"_id": 0}).sort("created_at", -1).to_list(200)
    out = []
    for o in docs:
        listing = await db.listings.find_one({"listing_id": o["listing_id"]}, {"_id": 0})
        o["listing"] = listing
        o.setdefault("status", "pending")
        out.append(o)
    return out


# ---------------------------------------------------------------------------
# Reviews & replies
# ---------------------------------------------------------------------------
async def decorate_review(r: dict) -> dict:
    r["author"] = user_summary(await get_user(r["author_id"]))
    listing = await db.listings.find_one({"listing_id": r["listing_id"]}, {"_id": 0, "title": 1, "listing_id": 1})
    r["listing"] = listing
    replies = await db.review_replies.find({"review_id": r["review_id"], "deleted_at": None}, {"_id": 0}).sort("created_at", 1).to_list(200)
    for rep in replies:
        rep["author"] = user_summary(await get_user(rep["author_id"]))
    r["replies"] = replies
    return r


@api.post("/listings/{listing_id}/reviews")
async def create_review(listing_id: str, body: ReviewCreate, user: dict = Depends(current_user)):
    if user.get("role") != "tenant":
        raise HTTPException(status_code=403, detail="Only tenants can leave reviews")
    listing = await db.listings.find_one({"listing_id": listing_id, "deleted_at": None}, {"_id": 0})
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    review = {
        "review_id": new_id("rev"),
        "listing_id": listing_id,
        "owner_id": listing["owner_id"],
        "author_id": user["user_id"],
        "rating": body.rating,
        "text": body.text,
        "created_at": now(),
        "deleted_at": None,
    }
    await db.reviews.insert_one(review)
    review.pop("_id", None)
    return await decorate_review(review)


@api.get("/reviews")
async def list_reviews(listing_id: str = Query(""), user_id: str = Query("")):
    filt: dict = {"deleted_at": None}
    if listing_id:
        filt["listing_id"] = listing_id
    if user_id:
        filt["owner_id"] = user_id
    docs = await db.reviews.find(filt, {"_id": 0}).sort("created_at", -1).to_list(200)
    return [await decorate_review(r) for r in docs]


@api.post("/reviews/{review_id}/replies")
async def reply_review(review_id: str, body: ReplyCreate, user: dict = Depends(current_user)):
    review = await db.reviews.find_one({"review_id": review_id, "deleted_at": None}, {"_id": 0})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    reply = {
        "reply_id": new_id("rep"),
        "review_id": review_id,
        "author_id": user["user_id"],
        "text": body.text,
        "created_at": now(),
        "deleted_at": None,
    }
    await db.review_replies.insert_one(reply)
    reply.pop("_id", None)
    reply["author"] = user_summary(user)
    return reply


# ---------------------------------------------------------------------------
# Seed demo data
# ---------------------------------------------------------------------------
SEED_LISTINGS = [
    {
        "title": "Sunlit 2-Bed Flat in Lekki Phase 1",
        "description": "Bright, airy apartment with 24/7 power, a rooftop terrace and 5 mins walk to the beach road. Perfect for young professionals.",
        "address": "Admiralty Way, Lekki Phase 1, Lagos, Nigeria",
        "city": "Lagos", "country": "Nigeria", "country_code": "NG",
        "lat": 6.4416, "lng": 3.4750, "price": 3500000, "period": "year",
        "property_type": "apartment", "bedrooms": 2, "bathrooms": 2,
        "photos": ["https://images.pexels.com/photos/7546648/pexels-photo-7546648.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
                   "https://images.pexels.com/photos/7147370/pexels-photo-7147370.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"],
    },
    {
        "title": "Cozy Studio near Yaba Tech Hub",
        "description": "Compact studio with fibre internet, ideal for remote workers. Weekly rent, fully furnished.",
        "address": "Herbert Macaulay Way, Yaba, Lagos, Nigeria",
        "city": "Lagos", "country": "Nigeria", "country_code": "NG",
        "lat": 6.5095, "lng": 3.3711, "price": 45000, "period": "week",
        "property_type": "studio", "bedrooms": 1, "bathrooms": 1,
        "photos": ["https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"],
    },
    {
        "title": "Modern Loft in Jing'an, Shanghai",
        "description": "High ceilings, floor-to-ceiling windows and a short walk to Line 2. Pets welcome.",
        "address": "Nanjing West Road, Jing'an, Shanghai, China",
        "city": "Shanghai", "country": "China", "country_code": "CN",
        "lat": 31.2304, "lng": 121.4737, "price": 9800, "period": "month",
        "property_type": "loft", "bedrooms": 1, "bathrooms": 1,
        "photos": ["https://images.pexels.com/photos/1918291/pexels-photo-1918291.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"],
    },
    {
        "title": "Brooklyn Brownstone Garden Unit",
        "description": "Garden-level 1BR with private patio in Bed-Stuy. Laundry in unit, no broker fee ever.",
        "address": "Nostrand Ave, Brooklyn, NY, USA",
        "city": "New York", "country": "United States", "country_code": "US",
        "lat": 40.6872, "lng": -73.9418, "price": 2650, "period": "month",
        "property_type": "apartment", "bedrooms": 1, "bathrooms": 1,
        "photos": ["https://images.pexels.com/photos/2635038/pexels-photo-2635038.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"],
    },
    {
        "title": "Riverside Room in Shoreditch",
        "description": "Double room in a creative flatshare, bills included, 3 mins to Overground.",
        "address": "Curtain Road, Shoreditch, London, UK",
        "city": "London", "country": "United Kingdom", "country_code": "GB",
        "lat": 51.5246, "lng": -0.0806, "price": 320, "period": "week",
        "property_type": "room", "bedrooms": 1, "bathrooms": 1,
        "photos": ["https://images.pexels.com/photos/1648776/pexels-photo-1648776.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"],
    },
]


async def seed():
    if await db.listings.count_documents({}) > 0:
        return
    owner_id = new_id("user")
    tenant_id = new_id("user")
    pw = hash_password("Password123!")
    await db.users.insert_many([
        {"user_id": owner_id, "email": "owner@renter.app", "name": "Adaeze Okafor", "role": "homeowner",
         "phone": "+2348012345678", "whatsapp": "+2348012345678",
         "bio": "Property owner across Lagos, Shanghai and NYC. No agents, no hidden fees — just fair rent and quick replies.",
         "picture": "https://images.unsplash.com/photo-1740252117027-4275d3f84385?crop=entropy&cs=srgb&fm=jpg&q=85&w=400",
         "city": "Lagos", "country": "Nigeria", "auth_provider": "password", "password_hash": pw, "created_at": now()},
        {"user_id": tenant_id, "email": "tenant@renter.app", "name": "Tobi Adeyemi", "role": "tenant",
         "phone": "+2347011122233", "whatsapp": "+2347011122233",
         "bio": "Product designer, tidy, non-smoker. Looking for a bright place near the water.",
         "picture": "", "city": "Lagos", "country": "Nigeria", "auth_provider": "password", "password_hash": pw, "created_at": now()},
    ])
    listing_ids = []
    for i, l in enumerate(SEED_LISTINGS):
        cur = currency_for_country(l["country_code"])
        lid = new_id("lst")
        listing_ids.append(lid)
        await db.listings.insert_one({**l, "listing_id": lid, "owner_id": owner_id, "currency": cur["code"],
                                      "currency_symbol": cur["symbol"], "created_at": now() - timedelta(days=i), "deleted_at": None})
    await db.offers.insert_one({
        "offer_id": new_id("off"), "listing_id": listing_ids[0], "tenant_id": tenant_id, "owner_id": owner_id,
        "amount": 3200000, "currency": "NGN", "currency_symbol": "₦", "period": "year",
        "message": "Can move in next month, happy to pay a year upfront.", "created_at": now(), "deleted_at": None,
    })
    rid = new_id("rev")
    await db.reviews.insert_one({
        "review_id": rid, "listing_id": listing_ids[0], "owner_id": owner_id, "author_id": tenant_id, "rating": 5,
        "text": "Viewed the flat last week — exactly as pictured, and Adaeze replied within minutes.", "created_at": now(), "deleted_at": None,
    })
    await db.review_replies.insert_one({
        "reply_id": new_id("rep"), "review_id": rid, "author_id": owner_id,
        "text": "Thanks Tobi! Looking forward to hosting you.", "created_at": now(), "deleted_at": None,
    })
    logger.info("Seeded demo data")


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.listings.create_index("listing_id", unique=True)
    await db.offers.create_index("listing_id")
    await db.reviews.create_index("listing_id")
    await db.files.create_index("storage_path")
    await db.favorites.create_index([("user_id", 1), ("listing_id", 1)], unique=True)
    try:
        await run_in_threadpool(init_storage)
    except Exception as e:
        logger.warning(f"Storage init failed: {e}")
    try:
        await seed()
    except Exception as e:
        logger.warning(f"Seed failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


@api.get("/")
async def root():
    return {"app": "Renter", "ok": True}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
