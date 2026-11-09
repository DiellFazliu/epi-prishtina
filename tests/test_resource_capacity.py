import unittest
from unittest.mock import Mock

from src.allocation.resource_allocator import ResourceAllocator
from src.api.v1.simulation import ResourceInventoryUpdate


class ResourceCapacityTests(unittest.TestCase):
    def test_optimize_all_passes_persistent_capacities_to_each_allocator(self):
        allocator = ResourceAllocator()
        allocator.allocate_ambulances = Mock(return_value=[])
        allocator.allocate_testing_units = Mock(return_value=[])
        allocator.allocate_beds = Mock(return_value=[])
        allocator.allocate_vaccines = Mock(return_value=[])
        allocator.allocate_staff = Mock(return_value=[])

        capacities = {
            "ambulance": 7,
            "testing_unit": 4,
            "bed": 120,
            "vaccine": 9000,
            "staff": 45,
        }

        allocator.optimize_all(capacities=capacities)

        allocator.allocate_ambulances.assert_called_once_with(7)
        allocator.allocate_testing_units.assert_called_once_with(4)
        allocator.allocate_beds.assert_called_once_with(120)
        allocator.allocate_vaccines.assert_called_once_with(9000)
        allocator.allocate_staff.assert_called_once_with(45)

    def test_inventory_update_accepts_zero_and_rejects_negative_values(self):
        self.assertEqual(ResourceInventoryUpdate(total_quantity=0).total_quantity, 0)
        with self.assertRaises(ValueError):
            ResourceInventoryUpdate(total_quantity=-1)

    def test_unknown_capacity_uses_allocator_default(self):
        allocator = ResourceAllocator()
        allocator.allocate_ambulances = Mock(return_value=[])
        allocator.allocate_testing_units = Mock(return_value=[])
        allocator.allocate_beds = Mock(return_value=[])
        allocator.allocate_vaccines = Mock(return_value=[])
        allocator.allocate_staff = Mock(return_value=[])

        allocator.optimize_all(capacities={"ambulance": 11})

        allocator.allocate_ambulances.assert_called_once_with(11)
        allocator.allocate_testing_units.assert_called_once()
        allocator.allocate_beds.assert_called_once()
        allocator.allocate_vaccines.assert_called_once()
        allocator.allocate_staff.assert_called_once()


if __name__ == "__main__":
    unittest.main()
