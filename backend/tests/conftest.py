import os
import pytest
import requests

BASE_URL = "https://direct-housing-2.preview.emergentagent.com"


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def api_client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(email: str, password: str) -> dict:
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=20)
    r.raise_for_status()
    return r.json()


@pytest.fixture(scope="session")
def owner_auth():
    return _login("owner@renter.app", "Password123!")


@pytest.fixture(scope="session")
def tenant_auth():
    return _login("tenant@renter.app", "Password123!")


@pytest.fixture()
def owner_headers(owner_auth):
    return {"Authorization": f"Bearer {owner_auth['token']}"}


@pytest.fixture()
def tenant_headers(tenant_auth):
    return {"Authorization": f"Bearer {tenant_auth['token']}"}
