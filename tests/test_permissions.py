import unittest
from types import SimpleNamespace

from fastapi import HTTPException

from src.core.security import require_admin, require_health_worker, require_analyst


class PermissionMatrixTests(unittest.TestCase):
    def _check(self, dependency, role, allowed):
        user = SimpleNamespace(role=SimpleNamespace(value=role))
        if allowed:
            self.assertIs(dependency(current_user=user), user)
        else:
            with self.assertRaises(HTTPException) as context:
                dependency(current_user=user)
            self.assertEqual(context.exception.status_code, 403)

    def test_admin_has_full_operational_access(self):
        for dependency in (require_admin, require_health_worker, require_analyst):
            self._check(dependency, "admin", allowed=True)

    def test_health_worker_can_operate_but_not_administer_users(self):
        self._check(require_admin, "health_worker", allowed=False)
        self._check(require_health_worker, "health_worker", allowed=True)
        self._check(require_analyst, "health_worker", allowed=True)

    def test_analyst_is_read_only(self):
        self._check(require_admin, "analyst", allowed=False)
        self._check(require_health_worker, "analyst", allowed=False)
        self._check(require_analyst, "analyst", allowed=True)

    def test_citizen_has_no_staff_access(self):
        for dependency in (require_admin, require_health_worker, require_analyst):
            self._check(dependency, "citizen", allowed=False)


if __name__ == "__main__":
    unittest.main()
