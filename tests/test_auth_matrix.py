# tests/test_auth_matrix.py
import pytest
from fastapi.testclient import TestClient

@pytest.mark.parametrize("endpoint,method,expected_codes", [
    ("/api/v1/reports", "GET", {"admin": 200, "health_worker": 200, "analyst": 200, "citizen": 200}),
    ("/api/v1/reports", "POST", {"admin": 200, "health_worker": 200, "analyst": 403, "citizen": 200}),
    ("/api/v1/users", "GET", {"admin": 200, "health_worker": 403, "analyst": 403, "citizen": 403}),
    ("/api/v1/pipeline/apply", "POST", {"admin": 200, "health_worker": 200, "analyst": 403, "citizen": 403}),
])
def test_permission_matrix(client, auth_tokens, endpoint, method, expected_codes):
    for role, expected in expected_codes.items():
        token = auth_tokens[role]
        response = client.request(method, endpoint, headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == expected, f"{role} on {method} {endpoint}: expected {expected}, got {response.status_code}"