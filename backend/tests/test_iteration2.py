"""Iteration 2: Favorites, Smart Filters (price/bedrooms/type/near-me), Offer Responses (accept/decline)."""
import uuid
import pytest
import requests

BASE_URL = "https://direct-housing-2.preview.emergentagent.com"


# ---------- Favorites ----------
class TestFavorites:
    def test_favorite_requires_auth(self):
        # need a listing id first
        listings = requests.get(f"{BASE_URL}/api/listings", timeout=20).json()
        lid = listings[0]["listing_id"]
        r = requests.post(f"{BASE_URL}/api/listings/{lid}/favorite", timeout=20)
        assert r.status_code == 401

    def test_favorite_toggle_and_list(self, tenant_headers):
        listings = requests.get(f"{BASE_URL}/api/listings", timeout=20).json()
        # pick a listing not currently favorited (fetch as viewer)
        as_viewer = requests.get(f"{BASE_URL}/api/listings", headers=tenant_headers, timeout=20).json()
        target = next((l for l in as_viewer if not l.get("is_favorited")), as_viewer[0])
        lid = target["listing_id"]

        # toggle ON
        r1 = requests.post(f"{BASE_URL}/api/listings/{lid}/favorite", headers=tenant_headers, timeout=20)
        assert r1.status_code == 200, r1.text
        assert r1.json()["favorited"] is True

        # Verify appears in GET /api/favorites
        favs = requests.get(f"{BASE_URL}/api/favorites", headers=tenant_headers, timeout=20)
        assert favs.status_code == 200
        fav_ids = {f["listing_id"] for f in favs.json()}
        assert lid in fav_ids

        # Verify is_favorited=true in GET /api/listings for viewer
        listed = requests.get(f"{BASE_URL}/api/listings", headers=tenant_headers, timeout=20).json()
        m = next(x for x in listed if x["listing_id"] == lid)
        assert m.get("is_favorited") is True

        # toggle OFF
        r2 = requests.post(f"{BASE_URL}/api/listings/{lid}/favorite", headers=tenant_headers, timeout=20)
        assert r2.status_code == 200
        assert r2.json()["favorited"] is False

        favs2 = requests.get(f"{BASE_URL}/api/favorites", headers=tenant_headers, timeout=20).json()
        assert lid not in {f["listing_id"] for f in favs2}

    def test_favorite_404_for_unknown_listing(self, tenant_headers):
        r = requests.post(f"{BASE_URL}/api/listings/lst_doesnotexist/favorite", headers=tenant_headers, timeout=20)
        assert r.status_code == 404

    def test_listings_is_favorited_false_when_anon(self):
        r = requests.get(f"{BASE_URL}/api/listings", timeout=20).json()
        assert all(x.get("is_favorited") is False for x in r)


# ---------- Smart filters ----------
class TestFilters:
    def test_min_max_price(self):
        r = requests.get(f"{BASE_URL}/api/listings", params={"min_price": 1000, "max_price": 100000}, timeout=20)
        assert r.status_code == 200
        for x in r.json():
            assert 1000 <= x["price"] <= 100000

    def test_bedrooms_gte(self):
        r = requests.get(f"{BASE_URL}/api/listings", params={"bedrooms": 2}, timeout=20)
        assert r.status_code == 200
        for x in r.json():
            assert x["bedrooms"] >= 2

    def test_property_type(self):
        r = requests.get(f"{BASE_URL}/api/listings", params={"property_type": "studio"}, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        for x in data:
            assert x["property_type"] == "studio"

    def test_near_me_lagos_radius(self):
        # Lagos lat/lng 6.5,3.4 within 25km should return the two seeded Lagos listings only
        r = requests.get(f"{BASE_URL}/api/listings", params={"lat": 6.5, "lng": 3.4, "radius_km": 25}, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 2, f"expected at least 2 Lagos listings within 25km, got {len(data)}"
        # sorted asc by distance_km
        distances = [x["distance_km"] for x in data]
        assert distances == sorted(distances)
        for x in data:
            assert x["city"] == "Lagos"
            assert x["distance_km"] is not None and x["distance_km"] <= 25

    def test_near_me_shanghai_excludes_others(self):
        r = requests.get(f"{BASE_URL}/api/listings", params={"lat": 31.23, "lng": 121.47, "radius_km": 25}, timeout=20)
        assert r.status_code == 200
        data = r.json()
        for x in data:
            assert x["city"] == "Shanghai"

    def test_combined_filter_q_and_period(self):
        r = requests.get(f"{BASE_URL}/api/listings", params={"q": "Lagos", "period": "week"}, timeout=20)
        assert r.status_code == 200
        for x in r.json():
            assert x["period"] == "week"


# ---------- Offer responses ----------
@pytest.fixture()
def fresh_offer(tenant_headers):
    """Create a listing-scoped fresh offer as tenant, return (offer_id, listing_id)."""
    listings = requests.get(f"{BASE_URL}/api/listings", timeout=20).json()
    lid = listings[0]["listing_id"]
    r = requests.post(
        f"{BASE_URL}/api/listings/{lid}/offers",
        json={"amount": 1000000, "message": f"TEST offer {uuid.uuid4().hex[:6]}"},
        headers=tenant_headers,
        timeout=20,
    )
    assert r.status_code == 200, r.text
    o = r.json()
    assert o.get("status") == "pending"
    return o["offer_id"], lid


class TestOfferResponses:
    def test_offer_default_status_pending(self, tenant_headers):
        r = requests.get(f"{BASE_URL}/api/offers/mine", headers=tenant_headers, timeout=20).json()
        assert len(r) >= 1
        # Every offer must have a status field, default 'pending'
        for o in r:
            assert o.get("status") in {"pending", "accepted", "declined"}

    def test_list_offers_includes_status(self, fresh_offer):
        _, lid = fresh_offer
        r = requests.get(f"{BASE_URL}/api/listings/{lid}/offers", timeout=20)
        assert r.status_code == 200
        for o in r.json():
            assert "status" in o

    def test_tenant_cannot_respond(self, fresh_offer, tenant_headers):
        oid, _ = fresh_offer
        r = requests.patch(
            f"{BASE_URL}/api/offers/{oid}",
            json={"status": "accepted"},
            headers=tenant_headers,
            timeout=20,
        )
        assert r.status_code == 403

    def test_other_homeowner_cannot_respond(self, fresh_offer):
        oid, _ = fresh_offer
        # register a fresh homeowner
        email = f"TEST_other_owner_{uuid.uuid4().hex[:6]}@renter.app"
        reg = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": email, "password": "Password123!", "name": "TEST Other", "role": "homeowner"},
            timeout=20,
        )
        assert reg.status_code == 200
        other_headers = {"Authorization": f"Bearer {reg.json()['token']}"}
        r = requests.patch(
            f"{BASE_URL}/api/offers/{oid}",
            json={"status": "declined"},
            headers=other_headers,
            timeout=20,
        )
        assert r.status_code == 403

    def test_owner_accepts_offer(self, fresh_offer, owner_headers, tenant_headers):
        oid, lid = fresh_offer
        r = requests.patch(
            f"{BASE_URL}/api/offers/{oid}",
            json={"status": "accepted"},
            headers=owner_headers,
            timeout=20,
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "accepted"

        # Verify persisted in GET listing/offers
        offers = requests.get(f"{BASE_URL}/api/listings/{lid}/offers", timeout=20).json()
        target = next(o for o in offers if o["offer_id"] == oid)
        assert target["status"] == "accepted"

        # Verify tenant sees it in /offers/mine
        mine = requests.get(f"{BASE_URL}/api/offers/mine", headers=tenant_headers, timeout=20).json()
        target2 = next(o for o in mine if o["offer_id"] == oid)
        assert target2["status"] == "accepted"

    def test_owner_declines_offer(self, fresh_offer, owner_headers):
        oid, _ = fresh_offer
        r = requests.patch(
            f"{BASE_URL}/api/offers/{oid}",
            json={"status": "declined"},
            headers=owner_headers,
            timeout=20,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "declined"

    def test_invalid_status_rejected(self, fresh_offer, owner_headers):
        oid, _ = fresh_offer
        r = requests.patch(
            f"{BASE_URL}/api/offers/{oid}",
            json={"status": "maybe"},
            headers=owner_headers,
            timeout=20,
        )
        assert r.status_code == 422

    def test_patch_unknown_offer_404(self, owner_headers):
        r = requests.patch(
            f"{BASE_URL}/api/offers/off_doesnotexist",
            json={"status": "accepted"},
            headers=owner_headers,
            timeout=20,
        )
        assert r.status_code == 404
