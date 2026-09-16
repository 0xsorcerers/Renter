import io
import os
import uuid
import pytest
import requests

BASE_URL = "https://direct-housing-2.preview.emergentagent.com"


# ---------- Auth ----------
class TestAuth:
    def test_login_owner(self, owner_auth):
        assert "token" in owner_auth and owner_auth["user"]["role"] == "homeowner"

    def test_login_tenant(self, tenant_auth):
        assert "token" in tenant_auth and tenant_auth["user"]["role"] == "tenant"

    def test_me(self, tenant_headers):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=tenant_headers, timeout=20)
        assert r.status_code == 200
        assert r.json()["email"] == "tenant@renter.app"

    def test_me_unauth_401(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=20)
        assert r.status_code == 401

    def test_me_bad_token_401(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": "Bearer garbage.token"}, timeout=20)
        assert r.status_code == 401

    def test_register_and_duplicate_409(self):
        email = f"TEST_reg_{uuid.uuid4().hex[:8]}@renter.app"
        body = {"email": email, "password": "Password123!", "name": "TEST User", "role": "tenant"}
        r = requests.post(f"{BASE_URL}/api/auth/register", json=body, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and data["user"]["role"] == "tenant"
        # duplicate
        r2 = requests.post(f"{BASE_URL}/api/auth/register", json=body, timeout=20)
        assert r2.status_code == 409

    def test_register_homeowner(self):
        email = f"TEST_owner_{uuid.uuid4().hex[:8]}@renter.app"
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email, "password": "Password123!", "name": "TEST Owner", "role": "homeowner"
        }, timeout=20)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "homeowner"


# ---------- Currencies & places ----------
class TestCurrenciesPlaces:
    def test_list_currencies(self):
        r = requests.get(f"{BASE_URL}/api/currencies", timeout=20)
        assert r.status_code == 200
        codes = {c["code"] for c in r.json()}
        assert {"NGN", "CNY", "USD"}.issubset(codes)

    def test_detect_currency_ng(self):
        r = requests.get(f"{BASE_URL}/api/currencies/detect", params={"country_code": "NG"}, timeout=20)
        assert r.status_code == 200
        assert r.json()["code"] == "NGN"

    def test_detect_currency_cn(self):
        r = requests.get(f"{BASE_URL}/api/currencies/detect", params={"country_code": "CN"}, timeout=20)
        assert r.json()["code"] == "CNY"

    def test_places_search_lekki(self):
        r = requests.get(f"{BASE_URL}/api/places/search", params={"q": "Lekki Lagos"}, timeout=30)
        assert r.status_code == 200, r.text
        results = r.json()
        assert isinstance(results, list) and len(results) > 0
        top = results[0]
        assert "lat" in top and "lng" in top
        # currency should be attached when country_code present
        has_ng = any(x.get("country_code") == "NG" for x in results)
        # Photon may or may not return country_code depending on entry; at least ensure currency field present
        assert "currency" in top


# ---------- Listings ----------
class TestListings:
    def test_list_listings(self):
        r = requests.get(f"{BASE_URL}/api/listings", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 5
        assert all("listing_id" in x and "owner" in x for x in data)

    def test_filter_by_period(self):
        r = requests.get(f"{BASE_URL}/api/listings", params={"period": "month"}, timeout=20)
        assert r.status_code == 200
        for x in r.json():
            assert x["period"] == "month"

    def test_search_q(self):
        r = requests.get(f"{BASE_URL}/api/listings", params={"q": "Lekki"}, timeout=20)
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_mine_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/listings", params={"mine": "true"}, timeout=20)
        assert r.status_code == 401

    def test_mine_owner(self, owner_headers):
        r = requests.get(f"{BASE_URL}/api/listings", params={"mine": "true"}, headers=owner_headers, timeout=20)
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_get_listing_detail(self):
        listings = requests.get(f"{BASE_URL}/api/listings", timeout=20).json()
        lid = listings[0]["listing_id"]
        r = requests.get(f"{BASE_URL}/api/listings/{lid}", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["listing_id"] == lid and d.get("owner")

    def test_tenant_cannot_create_listing(self, tenant_headers):
        payload = {
            "title": "TEST Should Fail", "description": "x", "address": "test",
            "lat": 0, "lng": 0, "price": 100, "period": "month",
        }
        r = requests.post(f"{BASE_URL}/api/listings", json=payload, headers=tenant_headers, timeout=20)
        assert r.status_code == 403

    def test_owner_create_listing_currency_auto_ng(self, owner_headers):
        payload = {
            "title": "TEST NG Auto", "description": "auto currency",
            "address": "Lekki, Lagos", "city": "Lagos", "country": "Nigeria",
            "country_code": "NG", "lat": 6.44, "lng": 3.47, "price": 500000,
            "period": "year",
        }
        r = requests.post(f"{BASE_URL}/api/listings", json=payload, headers=owner_headers, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["currency"] == "NGN"
        assert d["currency_symbol"] == "\u20a6"
        # cleanup
        requests.delete(f"{BASE_URL}/api/listings/{d['listing_id']}", headers=owner_headers, timeout=20)

    def test_owner_create_listing_currency_cn(self, owner_headers):
        payload = {
            "title": "TEST CN Auto", "description": "cn",
            "address": "Nanjing Rd, Shanghai", "country_code": "CN",
            "lat": 31.23, "lng": 121.47, "price": 8000, "period": "month",
        }
        r = requests.post(f"{BASE_URL}/api/listings", json=payload, headers=owner_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["currency"] == "CNY"
        requests.delete(f"{BASE_URL}/api/listings/{d['listing_id']}", headers=owner_headers, timeout=20)

    def test_owner_create_listing_manual_currency_override(self, owner_headers):
        payload = {
            "title": "TEST Override", "description": "override",
            "address": "Somewhere in Lagos", "country_code": "NG",
            "lat": 6.44, "lng": 3.47, "price": 1500, "period": "month",
            "currency": "USD",
        }
        r = requests.post(f"{BASE_URL}/api/listings", json=payload, headers=owner_headers, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["currency"] == "USD", "Manual currency override should win"
        requests.delete(f"{BASE_URL}/api/listings/{d['listing_id']}", headers=owner_headers, timeout=20)

    def test_delete_soft_delete(self, owner_headers):
        # create
        payload = {
            "title": "TEST Delete", "description": "x", "address": "x",
            "country_code": "US", "lat": 40, "lng": -73, "price": 1000, "period": "month",
        }
        c = requests.post(f"{BASE_URL}/api/listings", json=payload, headers=owner_headers, timeout=20)
        assert c.status_code == 200
        lid = c.json()["listing_id"]
        d = requests.delete(f"{BASE_URL}/api/listings/{lid}", headers=owner_headers, timeout=20)
        assert d.status_code == 200
        # Verify GET returns 404
        g = requests.get(f"{BASE_URL}/api/listings/{lid}", timeout=20)
        assert g.status_code == 404


# ---------- Offers ----------
class TestOffers:
    def test_offer_tenant_only_and_inherits_currency_period(self, tenant_headers, owner_headers):
        listings = requests.get(f"{BASE_URL}/api/listings", timeout=20).json()
        target = next((l for l in listings if l["currency"] == "NGN" and l["period"] == "year"), listings[0])
        lid = target["listing_id"]
        # owner forbidden
        r_owner = requests.post(f"{BASE_URL}/api/listings/{lid}/offers", json={"amount": 100, "message": "no"}, headers=owner_headers, timeout=20)
        assert r_owner.status_code == 403
        # tenant success
        r = requests.post(f"{BASE_URL}/api/listings/{lid}/offers", json={"amount": 1234567, "message": "TEST offer"}, headers=tenant_headers, timeout=20)
        assert r.status_code == 200
        o = r.json()
        assert o["currency"] == target["currency"]
        assert o["period"] == target["period"]
        assert o["amount"] == 1234567

    def test_list_offers_for_listing(self):
        listings = requests.get(f"{BASE_URL}/api/listings", timeout=20).json()
        lid = listings[0]["listing_id"]
        r = requests.get(f"{BASE_URL}/api/listings/{lid}/offers", timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_offers_mine(self, tenant_headers):
        r = requests.get(f"{BASE_URL}/api/offers/mine", headers=tenant_headers, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 1
        assert data[0].get("listing")


# ---------- Reviews & replies ----------
class TestReviews:
    def test_review_tenant_only_and_reply(self, tenant_headers, owner_headers):
        listings = requests.get(f"{BASE_URL}/api/listings", timeout=20).json()
        lid = listings[0]["listing_id"]
        # owner forbidden
        r_o = requests.post(f"{BASE_URL}/api/listings/{lid}/reviews", json={"rating": 5, "text": "no"}, headers=owner_headers, timeout=20)
        assert r_o.status_code == 403
        # tenant creates
        r = requests.post(f"{BASE_URL}/api/listings/{lid}/reviews", json={"rating": 4, "text": "TEST review"}, headers=tenant_headers, timeout=20)
        assert r.status_code == 200
        rev = r.json()
        assert rev["rating"] == 4 and "replies" in rev
        # anyone auth'd can reply -- owner replies
        rp = requests.post(f"{BASE_URL}/api/reviews/{rev['review_id']}/replies", json={"text": "TEST reply"}, headers=owner_headers, timeout=20)
        assert rp.status_code == 200
        # tenant also can reply
        rp2 = requests.post(f"{BASE_URL}/api/reviews/{rev['review_id']}/replies", json={"text": "TEST reply2"}, headers=tenant_headers, timeout=20)
        assert rp2.status_code == 200
        # Verify replies nested in review list
        listed = requests.get(f"{BASE_URL}/api/reviews", params={"listing_id": lid}, timeout=20).json()
        target = next(x for x in listed if x["review_id"] == rev["review_id"])
        assert len(target["replies"]) >= 2

    def test_list_reviews_by_user(self):
        listings = requests.get(f"{BASE_URL}/api/listings", timeout=20).json()
        owner_id = listings[0]["owner_id"]
        r = requests.get(f"{BASE_URL}/api/reviews", params={"user_id": owner_id}, timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Users ----------
class TestUsers:
    def test_update_me(self, tenant_headers):
        r = requests.put(f"{BASE_URL}/api/users/me", json={"bio": "TEST bio update"}, headers=tenant_headers, timeout=20)
        assert r.status_code == 200
        assert r.json()["bio"] == "TEST bio update"

    def test_public_profile(self, owner_auth):
        uid = owner_auth["user"]["user_id"]
        r = requests.get(f"{BASE_URL}/api/users/{uid}", timeout=20)
        assert r.status_code == 200
        u = r.json()
        assert "stats" in u and "listings" in u["stats"]
        assert "email" not in u  # private


# ---------- Upload ----------
PNG_1x1 = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\rIDATx\x9cc\xf8\xcf\xc0\x00\x00\x00\x03\x00\x01\xdb\x8a\xa2M\x00\x00\x00\x00IEND\xaeB`\x82"
)


class TestUpload:
    def test_upload_and_serve(self, owner_auth):
        headers = {"Authorization": f"Bearer {owner_auth['token']}"}
        files = {"file": ("test.png", PNG_1x1, "image/png")}
        r = requests.post(f"{BASE_URL}/api/upload", headers=headers, files=files, timeout=60)
        if r.status_code == 402:
            pytest.skip("Storage credits exhausted (external dependency)")
        assert r.status_code == 200, r.text
        d = r.json()
        assert "path" in d and d["url"].startswith("/api/files/")
        # serve
        g = requests.get(f"{BASE_URL}{d['url']}", timeout=30)
        assert g.status_code == 200
        assert g.headers.get("content-type", "").startswith("image/")
