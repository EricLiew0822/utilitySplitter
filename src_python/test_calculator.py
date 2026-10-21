#!/usr/bin/env python3
"""
Unit tests for the Electricity and Water Bill Calculator
"""
import unittest
from calculator import BillInput, Room, BillCalculator

class TestBillCalculator(unittest.TestCase):
    def test_reference_sheet_exact_match(self):
        bill = BillInput(
            billing_period_electric="12 August 2026",
            billing_period_water="May to July 2026",
            electric_amount=157.15,
            previous_balance=2.42,
            total_kwh=477.0,
            water_amount=7.00,
            rooms=[
                Room(name="Master", prev_meter=5574, curr_meter=5774, tenants=["Bryan", "Thomas"]),
                Room(name="Middle", prev_meter=4693, curr_meter=4693, tenants=["Eric"]),
                Room(name="Small", prev_meter=4255, curr_meter=4312, tenants=["Alex"]),
            ],
            rate_mode="ceil"
        )

        calc = BillCalculator(bill)
        res = calc.calculate()

        # 1. Rate check
        self.assertAlmostEqual(res.unit_rate_applied, 0.33, places=2)

        # 2. Common kWh & Cost check
        self.assertEqual(res.common_kwh, 220.0)
        self.assertAlmostEqual(res.common_cost_per_person, 18.15, places=2)

        # 3. Water per person check
        self.assertAlmostEqual(res.water_cost_per_person, 1.75, places=2)

        # 4. Room kWh checks
        self.assertEqual(res.room_summaries[0].kwh_used, 200.0)
        self.assertEqual(res.room_summaries[1].kwh_used, 0.0)
        self.assertEqual(res.room_summaries[2].kwh_used, 57.0)

        # 5. Tenant breakdowns check
        tenant_map = {t.tenant_name: t for t in res.tenant_breakdowns}
        self.assertAlmostEqual(tenant_map["Bryan"].total, 52.90, places=2)
        self.assertAlmostEqual(tenant_map["Thomas"].total, 52.90, places=2)
        self.assertAlmostEqual(tenant_map["Eric"].total, 19.90, places=2)
        self.assertAlmostEqual(tenant_map["Alex"].total, 38.71, places=2)

        # 6. Totals & Balance check
        self.assertAlmostEqual(res.total_collected, 164.41, places=2)
        self.assertAlmostEqual(res.actual_payable, 164.15, places=2)
        self.assertAlmostEqual(res.next_month_balance, 0.26, places=2)

        print("\n--- TEST RUN OUTPUT (Matches Image) ---")
        print(res.summary_report)
        print("---------------------------------------")

if __name__ == "__main__":
    unittest.main()
