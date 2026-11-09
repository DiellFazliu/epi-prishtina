import unittest

from src.api.v1.ambulance_routing import dispatch_transition_allowed


class DispatchLifecycleTests(unittest.TestCase):
    def test_active_dispatches_follow_forward_lifecycle(self):
        self.assertTrue(dispatch_transition_allowed("en_route", "at_scene"))
        self.assertTrue(dispatch_transition_allowed("at_scene", "completed"))
        self.assertTrue(dispatch_transition_allowed("en_route", "cancelled"))
        self.assertTrue(dispatch_transition_allowed("at_scene", "cancelled"))

    def test_terminal_dispatches_cannot_reopen(self):
        self.assertFalse(dispatch_transition_allowed("completed", "en_route"))
        self.assertFalse(dispatch_transition_allowed("completed", "at_scene"))
        self.assertFalse(dispatch_transition_allowed("cancelled", "en_route"))

    def test_repeated_status_is_idempotent(self):
        self.assertTrue(dispatch_transition_allowed("en_route", "en_route"))
        self.assertTrue(dispatch_transition_allowed("completed", "completed"))


if __name__ == "__main__":
    unittest.main()
