"""Iteration 3: In-app chat (conversations/messages), Mark as rented, Virtual tour video upload."""
import io
import struct
import uuid

import pytest
import requests

BASE_URL = "https://direct-housing-2.preview.emergentagent.com"


# ---------- Helpers ----------
def _owner_listings(owner_headers):
    r = requests.get(f"{BASE_URL}/api/listings", params={"mine": "true"}, headers=owner_headers, timeout=20)
    r.raise_for_status()
    return r.json()


def _pick_available_owner_listing(owner_headers):
    for l in _owner_listings(owner_headers):
        if l.get("status") != "rented":
            return l
    # relist first rented if only rented ones present
    l = _owner_listings(owner_headers)[0]
    requests.patch(
        f"{BASE_URL}/api/listings/{l['listing_id']}",
        json={"status": "available"},
        headers=owner_headers,
        timeout=20,
    )
    return l


def _make_offer(tenant_headers, listing_id, amount=800000):
    return requests.post(
        f"{BASE_URL}/api/listings/{listing_id}/offers",
        json={"amount": amount, "message": f"TEST offer {uuid.uuid4().hex[:6]}"},
        headers=tenant_headers,
        timeout=20,
    )


def _register(role: str = "homeowner"):
    email = f"TEST_{role}_{uuid.uuid4().hex[:6]}@renter.app"
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"email": email, "password": "Password123!", "name": f"TEST {role}", "role": role},
        timeout=20,
    )
    r.raise_for_status()
    return r.json(), {"Authorization": f"Bearer {r.json()['token']}"}


# ---------- Chat / Conversations ----------
class TestConversations:
    def test_tenant_without_offer_forbidden(self, owner_headers):
        # a fresh tenant with no offer trying to open chat with owner's listing
        _, fresh_tenant_headers = _register("tenant")
        listing = _pick_available_owner_listing(owner_headers)
        r = requests.post(
            f"{BASE_URL}/api/conversations",
            json={"listing_id": listing["listing_id"]},
            headers=fresh_tenant_headers,
            timeout=20,
        )
        assert r.status_code == 403, r.text

    def test_tenant_with_accepted_offer_opens_idempotently(self, owner_headers, tenant_headers):
        # Create a fresh listing so we can accept a fresh offer without polluting other tests
        listing = _pick_available_owner_listing(owner_headers)
        offer = _make_offer(tenant_headers, listing["listing_id"], amount=990000)
        assert offer.status_code == 200, offer.text
        oid = offer.json()["offer_id"]
        # accept
        acc = requests.patch(
            f"{BASE_URL}/api/offers/{oid}",
            json={"status": "accepted"},
            headers=owner_headers,
            timeout=20,
        )
        assert acc.status_code == 200

        r1 = requests.post(
            f"{BASE_URL}/api/conversations",
            json={"listing_id": listing["listing_id"]},
            headers=tenant_headers,
            timeout=20,
        )
        assert r1.status_code == 200, r1.text
        cid = r1.json()["conversation_id"]

        # idempotent - same id
        r2 = requests.post(
            f"{BASE_URL}/api/conversations",
            json={"listing_id": listing["listing_id"]},
            headers=tenant_headers,
            timeout=20,
        )
        assert r2.status_code == 200
        assert r2.json()["conversation_id"] == cid

    def test_owner_opens_with_tenant_who_offered(self, owner_headers, tenant_auth):
        listing = _pick_available_owner_listing(owner_headers)
        tenant_id = tenant_auth["user"]["user_id"]
        # tenant must have an offer (seed guarantees it; make one just in case)
        r = requests.post(
            f"{BASE_URL}/api/conversations",
            json={"listing_id": listing["listing_id"], "tenant_id": tenant_id},
            headers=owner_headers,
            timeout=20,
        )
        assert r.status_code == 200, r.text
        assert r.json()["owner_id"] == listing["owner_id"]
        assert r.json()["tenant_id"] == tenant_id

    def test_owner_without_tenant_offer_forbidden(self, owner_headers):
        # a fresh tenant who never made an offer
        fresh_reg, _ = _register("tenant")
        listing = _pick_available_owner_listing(owner_headers)
        r = requests.post(
            f"{BASE_URL}/api/conversations",
            json={"listing_id": listing["listing_id"], "tenant_id": fresh_reg["user"]["user_id"]},
            headers=owner_headers,
            timeout=20,
        )
        assert r.status_code == 403, r.text

    def test_owner_missing_tenant_id_400(self, owner_headers):
        listing = _pick_available_owner_listing(owner_headers)
        r = requests.post(
            f"{BASE_URL}/api/conversations",
            json={"listing_id": listing["listing_id"]},
            headers=owner_headers,
            timeout=20,
        )
        assert r.status_code == 400, r.text


class TestConversationListAndMessages:
    @pytest.fixture()
    def conversation_id(self, owner_headers, tenant_headers, tenant_auth):
        listing = _pick_available_owner_listing(owner_headers)
        off = _make_offer(tenant_headers, listing["listing_id"])
        oid = off.json()["offer_id"]
        requests.patch(
            f"{BASE_URL}/api/offers/{oid}",
            json={"status": "accepted"},
            headers=owner_headers,
            timeout=20,
        )
        r = requests.post(
            f"{BASE_URL}/api/conversations",
            json={"listing_id": listing["listing_id"]},
            headers=tenant_headers,
            timeout=20,
        )
        assert r.status_code == 200
        return r.json()["conversation_id"]

    def test_both_parties_list(self, conversation_id, owner_headers, tenant_headers):
        for hdrs in (owner_headers, tenant_headers):
            r = requests.get(f"{BASE_URL}/api/conversations", headers=hdrs, timeout=20)
            assert r.status_code == 200
            ids = [c["conversation_id"] for c in r.json()]
            assert conversation_id in ids
            match = next(c for c in r.json() if c["conversation_id"] == conversation_id)
            assert "other" in match and match["other"] is not None
            assert "listing" in match and match["listing"] is not None
            assert "unread" in match

    def test_third_party_cannot_read(self, conversation_id):
        _, third_headers = _register("tenant")
        r = requests.get(f"{BASE_URL}/api/conversations/{conversation_id}", headers=third_headers, timeout=20)
        assert r.status_code in (403, 404)

    def test_message_flow_marks_read(self, conversation_id, owner_headers, tenant_headers):
        # tenant sends 2 msgs -> owner unread=2 -> owner reads -> unread=0
        for txt in ("hi from tenant 1", "hi from tenant 2"):
            r = requests.post(
                f"{BASE_URL}/api/conversations/{conversation_id}/messages",
                json={"text": txt},
                headers=tenant_headers,
                timeout=20,
            )
            assert r.status_code == 200, r.text

        # owner unread
        u = requests.get(f"{BASE_URL}/api/conversations/unread", headers=owner_headers, timeout=20).json()
        assert u["unread"] >= 2, u

        # owner reads
        m = requests.get(f"{BASE_URL}/api/conversations/{conversation_id}/messages", headers=owner_headers, timeout=20)
        assert m.status_code == 200
        assert len(m.json()) >= 2

        u2 = requests.get(f"{BASE_URL}/api/conversations/unread", headers=owner_headers, timeout=20).json()
        # after read, unread drops for this convo (may still have unread from other convos)
        # so we assert per-conversation unread=0
        convs = requests.get(f"{BASE_URL}/api/conversations", headers=owner_headers, timeout=20).json()
        me = next(c for c in convs if c["conversation_id"] == conversation_id)
        assert me["unread"] == 0

    def test_empty_message_validation(self, conversation_id, tenant_headers):
        r = requests.post(
            f"{BASE_URL}/api/conversations/{conversation_id}/messages",
            json={"text": ""},
            headers=tenant_headers,
            timeout=20,
        )
        assert r.status_code == 422


# ---------- Mark as rented ----------
class TestMarkAsRented:
    def test_owner_rent_flow(self, owner_headers, tenant_headers):
        listing = _pick_available_owner_listing(owner_headers)
        lid = listing["listing_id"]
        # create a fresh pending offer we can verify closes
        off = _make_offer(tenant_headers, lid, amount=555000)
        assert off.status_code == 200
        pending_oid = off.json()["offer_id"]

        try:
            # tenant cannot patch
            r_forb = requests.patch(
                f"{BASE_URL}/api/listings/{lid}",
                json={"status": "rented"},
                headers=tenant_headers,
                timeout=20,
            )
            assert r_forb.status_code == 403

            # owner rents
            r = requests.patch(
                f"{BASE_URL}/api/listings/{lid}",
                json={"status": "rented"},
                headers=owner_headers,
                timeout=20,
            )
            assert r.status_code == 200, r.text
            assert r.json().get("status") == "rented"

            # not in GET /api/listings default
            public = requests.get(f"{BASE_URL}/api/listings", timeout=20).json()
            assert lid not in [x["listing_id"] for x in public]

            # visible with mine=true
            mine = requests.get(f"{BASE_URL}/api/listings", params={"mine": "true"}, headers=owner_headers, timeout=20).json()
            assert lid in [x["listing_id"] for x in mine]

            # visible with owner_id filter
            byowner = requests.get(f"{BASE_URL}/api/listings", params={"owner_id": listing["owner_id"]}, timeout=20).json()
            assert lid in [x["listing_id"] for x in byowner]

            # detail shows rented
            det = requests.get(f"{BASE_URL}/api/listings/{lid}", timeout=20).json()
            assert det["status"] == "rented"

            # pending offer -> closed
            offers = requests.get(f"{BASE_URL}/api/listings/{lid}/offers", timeout=20).json()
            target = next(o for o in offers if o["offer_id"] == pending_oid)
            assert target["status"] == "closed", target

            # tenant cannot make a new offer -> 409
            deny = _make_offer(tenant_headers, lid)
            assert deny.status_code == 409, deny.text
        finally:
            # relist to avoid polluting state
            requests.patch(
                f"{BASE_URL}/api/listings/{lid}",
                json={"status": "available"},
                headers=owner_headers,
                timeout=20,
            )

        # after relist, visible again
        public2 = requests.get(f"{BASE_URL}/api/listings", timeout=20).json()
        assert lid in [x["listing_id"] for x in public2]
        det2 = requests.get(f"{BASE_URL}/api/listings/{lid}", timeout=20).json()
        assert det2["status"] == "available"

    def test_patch_video_field(self, owner_headers):
        listing = _pick_available_owner_listing(owner_headers)
        lid = listing["listing_id"]
        url_val = "listings/fake-video.mp4"
        try:
            r = requests.patch(
                f"{BASE_URL}/api/listings/{lid}",
                json={"video": url_val},
                headers=owner_headers,
                timeout=20,
            )
            assert r.status_code == 200, r.text
            det = requests.get(f"{BASE_URL}/api/listings/{lid}", timeout=20).json()
            assert det.get("video") == url_val
        finally:
            requests.patch(
                f"{BASE_URL}/api/listings/{lid}",
                json={"video": None},
                headers=owner_headers,
                timeout=20,
            )


# ---------- Video upload ----------
def _tiny_mp4_bytes() -> bytes:
    """Minimal valid-looking mp4 header — the server only checks content_type + size."""
    ftyp = b"\x00\x00\x00\x20ftypisom\x00\x00\x02\x00isomiso2avc1mp41"
    mdat = b"\x00\x00\x00\x08mdat"
    return ftyp + mdat


class TestVideoUpload:
    def test_upload_small_video_and_fetch(self, owner_headers):
        blob = _tiny_mp4_bytes()
        files = {"file": ("clip.mp4", io.BytesIO(blob), "video/mp4")}
        # requests will set multipart; we must not force Content-Type=application/json
        headers = {k: v for k, v in owner_headers.items() if k.lower() != "content-type"}
        r = requests.post(f"{BASE_URL}/api/upload", files=files, headers=headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "path" in data and data["path"].endswith(".mp4")

        get = requests.get(f"{BASE_URL}/api/files/{data['path']}", timeout=20)
        assert get.status_code == 200
        assert get.headers.get("content-type", "").startswith("video/")
        assert len(get.content) == len(blob)
