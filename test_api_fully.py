"""
Test i plotë për REST API — të gjitha endpoints.
"""

import requests
import json
import os


BASE = "http://localhost:8000"
API = f"{BASE}/api/v1"
ADMIN_USERNAME = os.environ["TEST_ADMIN_USERNAME"]
ADMIN_PASSWORD = os.environ["TEST_ADMIN_PASSWORD"]


def print_separator(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")


def test_all():
    print_separator("EpiPrishtina API — Test i Plotë")

    # ═══ 1. Health ═══
    print_separator("1. Health Check")
    try:
        r = requests.get(f"{BASE}/")
        print(f"   ✓ Root: {r.status_code}")
        print(f"     {r.json()}")
    except Exception as e:
        print(f"   ✗ Root failed: {e}")
        return

    # ═══ 2. Dashboard Health ═══
    print_separator("2. Dashboard Health")
    r = requests.get(f"{API}/dashboard/health")
    print(f"   Status: {r.status_code}")
    if r.status_code == 200:
        print(f"   {r.json()}")

    # ═══ 3. Login ═══
    print_separator("3. Login")
    r = requests.post(f"{API}/auth/login", json={
        "username": ADMIN_USERNAME,
        "password": ADMIN_PASSWORD,
    })
    print(f"   Status: {r.status_code}")

    if r.status_code != 200:
        print(f"   ✗ Login dështoi: {r.text}")
        return

    tokens = r.json()
    access_token = tokens["access_token"]
    refresh_token = tokens["refresh_token"]
    print(f"   ✓ Access token: {access_token[:60]}...")
    print(f"   ✓ Refresh token: {refresh_token[:60]}...")

    headers = {"Authorization": f"Bearer {access_token}"}

    # ═══ 4. Get Me ═══
    print_separator("4. Get Current User")
    r = requests.get(f"{API}/auth/me", headers=headers)
    print(f"   Status: {r.status_code}")
    if r.status_code == 200:
        user = r.json()
        print(f"   ✓ User: {user['username']} ({user['role']})")
        print(f"   ✓ Email: {user['email']}")

    # ═══ 5. Create Report ═══
    print_separator("5. Create Report")
    r = requests.post(f"{API}/reports", json={
        "report_type": "symptom",
        "symptoms": ["fever", "cough", "fatigue"],
        "severity": 3,
        "district": "Qendra",
        "age_range": "30-44",
    })
    print(f"   Status: {r.status_code}")
    if r.status_code in (200, 201):
        report = r.json()
        print(f"   ✓ Report ID: {report['id']}")
        print(f"   ✓ Reliability: {report['reliability_score']:.2f}")
        print(f"   ✓ Status: {report['status']}")

    # ═══ 6. Create Confirmed Report ═══
    print_separator("6. Create Confirmed Report")
    r = requests.post(f"{API}/reports", json={
        "report_type": "confirmed",
        "symptoms": [],
        "severity": 4,
        "district": "Dardania",
        "age_range": "45-59",
    })
    print(f"   Status: {r.status_code}")
    if r.status_code in (200, 201):
        report = r.json()
        print(f"   ✓ Reliability: {report['reliability_score']:.2f}")

    # ═══ 7. List Reports ═══
    print_separator("7. List Reports")
    r = requests.get(f"{API}/reports?limit=5")
    print(f"   Status: {r.status_code}")
    if r.status_code == 200:
        reports = r.json()
        print(f"   ✓ Total returned: {len(reports)}")

    # ═══ 8. Report Statistics ═══
    print_separator("8. Report Statistics")
    r = requests.get(f"{API}/reports/statistics")
    print(f"   Status: {r.status_code}")
    if r.status_code == 200:
        stats = r.json()
        print(f"   ✓ Total: {stats['total']}")
        print(f"   ✓ Symptom: {stats['symptom']}")
        print(f"   ✓ Confirmed: {stats['confirmed']}")
        print(f"   ✓ Avg reliability: {stats['avg_reliability']:.2f}")

    # ═══ 9. Dashboard Summary ═══
    print_separator("9. Dashboard Summary")
    r = requests.get(f"{API}/dashboard/summary")
    print(f"   Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(f"   ✓ Users: {data['users']['total']}")
        print(f"   ✓ Reports: {data['reports']['total']}")
        print(f"   ✓ Top districts: {len(data['top_districts'])}")

    # ═══ 10. Simulation Summary ═══
    print_separator("10. Simulation Summary")
    r = requests.get(f"{API}/simulation/summary")
    print(f"   Status: {r.status_code}")
    if r.status_code == 200:
        sim = r.json()
        print(f"   ✓ Total days: {sim.get('total_days', 'N/A')}")
        if 'final' in sim:
            print(f"   ✓ Active: {sim['final'].get('active', 0)}")

    # ═══ 11. Hotspots ═══
    print_separator("11. Hotspots")
    r = requests.get(f"{API}/hotspots/top?n=3")
    print(f"   Status: {r.status_code}")
    if r.status_code == 200:
        hotspots = r.json()
        for h in hotspots[:3]:
            print(f"   ✓ {h['district']}: {h['probability']*100:.1f}%")

    # ═══ 12. Resources ═══
    print_separator("12. Resources Summary")
    r = requests.get(f"{API}/resources/summary")
    print(f"   Status: {r.status_code}")
    if r.status_code == 200:
        res = r.json()
        print(f"   ✓ Total cost: {res['total_cost']:.2f}")

    # ═══ 13. Users List (admin) ═══
    print_separator("13. Users List (admin)")
    r = requests.get(f"{API}/users", headers=headers)
    print(f"   Status: {r.status_code}")
    if r.status_code == 200:
        users = r.json()
        print(f"   ✓ Total users: {len(users)}")

    # ═══ 14. Refresh Token ═══
    print_separator("14. Refresh Token")
    r = requests.post(f"{API}/auth/refresh", json={
        "refresh_token": refresh_token,
    })
    print(f"   Status: {r.status_code}")
    if r.status_code == 200:
        print(f"   ✓ New access token: {r.json()['access_token'][:50]}...")

    # ═══ Summary ═══
    print_separator("TESTET PËRFUNDUAN")


if __name__ == "__main__":
    test_all()