#!/usr/bin/env python3
"""
Electricity and Water Bill Calculator Core Logic & Interactive CLI
"""
import sys
import os
import math
from dataclasses import dataclass, asdict
from typing import List, Dict, Any, Optional

@dataclass
class Room:
    name: str              # e.g., "大房", "Master Room"
    prev_meter: float      # e.g., 5574
    curr_meter: float      # e.g., 5774
    tenants: List[str]     # e.g., ["Bryan", "Thomas"]

    @property
    def kwh_used(self) -> float:
        return max(0.0, self.curr_meter - self.prev_meter)

@dataclass
class BillInput:
    billing_period_electric: str   # e.g., "By 12 August 2026"
    billing_period_water: str      # e.g., "May to July 2026"
    electric_amount: float         # e.g., 157.15
    previous_balance: float        # e.g., 2.42
    total_kwh: float               # e.g., 477.0
    water_amount: float            # e.g., 7.00
    rooms: List[Room]
    # rate_mode: 'ceil' (round up to 2 decimals, e.g. 0.3244 -> 0.33),
    #            'round' (standard 2 decimal places e.g. 0.32),
    #            'exact' (unrounded float),
    #            'manual' (use custom_rate)
    rate_mode: str = "ceil"
    custom_rate: Optional[float] = None

@dataclass
class TenantBreakdown:
    tenant_name: str
    room_name: str
    common_electric: float
    room_ac: float
    water: float
    total: float

@dataclass
class RoomSummary:
    room_name: str
    prev_meter: float
    curr_meter: float
    kwh_used: float
    total_room_ac_cost: float
    per_tenant_ac_cost: float
    tenants: List[str]

@dataclass
class CalculationResult:
    unit_rate_raw: float
    unit_rate_applied: float
    total_grid_kwh: float
    total_room_kwh: float
    common_kwh: float
    total_headcount: int
    common_cost_per_person: float
    water_cost_per_person: float
    room_summaries: List[RoomSummary]
    tenant_breakdowns: List[TenantBreakdown]
    total_collected: float
    actual_payable: float
    next_month_balance: float
    summary_report: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "unit_rate_raw": self.unit_rate_raw,
            "unit_rate_applied": self.unit_rate_applied,
            "total_grid_kwh": self.total_grid_kwh,
            "total_room_kwh": self.total_room_kwh,
            "common_kwh": self.common_kwh,
            "total_headcount": self.total_headcount,
            "common_cost_per_person": self.common_cost_per_person,
            "water_cost_per_person": self.water_cost_per_person,
            "room_summaries": [asdict(r) for r in self.room_summaries],
            "tenant_breakdowns": [asdict(t) for t in self.tenant_breakdowns],
            "total_collected": self.total_collected,
            "actual_payable": self.actual_payable,
            "next_month_balance": self.next_month_balance,
            "summary_report": self.summary_report,
        }

class BillCalculator:
    def __init__(self, data: BillInput):
        self.data = data

    def calculate(self) -> CalculationResult:
        # 1. Effective Rate Calculation
        net_electric = self.data.electric_amount - self.data.previous_balance
        raw_rate = net_electric / self.data.total_kwh if self.data.total_kwh > 0 else 0.0
        
        if self.data.rate_mode == "manual" and self.data.custom_rate is not None:
            unit_rate = self.data.custom_rate
        elif self.data.rate_mode == "ceil":
            unit_rate = math.ceil(raw_rate * 100) / 100.0
        elif self.data.rate_mode == "round":
            unit_rate = round(raw_rate, 2)
        else: # exact
            unit_rate = raw_rate

        # 2. Aggregations
        total_headcount = sum(len(r.tenants) for r in self.data.rooms)
        total_room_kwh = sum(r.kwh_used for r in self.data.rooms)
        common_kwh = max(0.0, self.data.total_kwh - total_room_kwh)

        common_cost_per_person = round((common_kwh * unit_rate) / total_headcount, 2) if total_headcount > 0 else 0.0
        water_cost_per_person = round(self.data.water_amount / total_headcount, 2) if total_headcount > 0 else 0.0

        # 3. Room & Tenant Breakdowns
        room_summaries: List[RoomSummary] = []
        tenant_breakdowns: List[TenantBreakdown] = []

        for room in self.data.rooms:
            room_kwh = room.kwh_used
            room_ac_cost = room_kwh * unit_rate
            num_occupants = len(room.tenants)
            per_tenant_ac = round(room_ac_cost / num_occupants, 2) if num_occupants > 0 else 0.0

            room_summaries.append(RoomSummary(
                room_name=room.name,
                prev_meter=room.prev_meter,
                curr_meter=room.curr_meter,
                kwh_used=room_kwh,
                total_room_ac_cost=round(room_ac_cost, 2),
                per_tenant_ac_cost=per_tenant_ac,
                tenants=room.tenants
            ))

            for tenant in room.tenants:
                t_total = round(common_cost_per_person + per_tenant_ac + water_cost_per_person, 2)
                tenant_breakdowns.append(TenantBreakdown(
                    tenant_name=tenant,
                    room_name=room.name,
                    common_electric=common_cost_per_person,
                    room_ac=per_tenant_ac,
                    water=water_cost_per_person,
                    total=t_total
                ))

        total_collected = round(sum(t.total for t in tenant_breakdowns), 2)
        actual_payable = round(self.data.electric_amount + self.data.water_amount, 2)
        next_month_balance = round(total_collected - actual_payable, 2)

        summary_report = self._format_summary_report(
            unit_rate=unit_rate,
            raw_rate=raw_rate,
            common_kwh=common_kwh,
            common_cost_per_person=common_cost_per_person,
            water_cost_per_person=water_cost_per_person,
            room_summaries=room_summaries,
            tenant_breakdowns=tenant_breakdowns,
            total_collected=total_collected,
            actual_payable=actual_payable,
            next_month_balance=next_month_balance
        )

        return CalculationResult(
            unit_rate_raw=raw_rate,
            unit_rate_applied=unit_rate,
            total_grid_kwh=self.data.total_kwh,
            total_room_kwh=total_room_kwh,
            common_kwh=common_kwh,
            total_headcount=total_headcount,
            common_cost_per_person=common_cost_per_person,
            water_cost_per_person=water_cost_per_person,
            room_summaries=room_summaries,
            tenant_breakdowns=tenant_breakdowns,
            total_collected=total_collected,
            actual_payable=actual_payable,
            next_month_balance=next_month_balance,
            summary_report=summary_report
        )

    def _format_summary_report(
        self,
        unit_rate: float,
        raw_rate: float,
        common_kwh: float,
        common_cost_per_person: float,
        water_cost_per_person: float,
        room_summaries: List[RoomSummary],
        tenant_breakdowns: List[TenantBreakdown],
        total_collected: float,
        actual_payable: float,
        next_month_balance: float
    ) -> str:
        total_headcount = sum(len(r.tenants) for r in self.data.rooms)
        room_kwh_parts = " – ".join(f"{r.kwh_used:.0f}" for r in room_summaries)
        
        lines = []
        lines.append(f"Electric Bill {self.data.billing_period_electric}")
        lines.append(f"(RM ({self.data.electric_amount:.2f}- {self.data.previous_balance:.2f}) / {self.data.total_kwh:.0f} kWh) = {raw_rate:.4f} ≈ RM {unit_rate:.2f} per kWh\n")
        
        lines.append(f"Common Usage ({self.data.total_kwh:.0f} – {room_kwh_parts} = {common_kwh:.0f} kWh)")
        lines.append(f"({common_kwh:.0f} kWh × RM{unit_rate:.2f}) / {total_headcount} = RM {common_cost_per_person:.2f}\n")
        
        lines.append(f"Water Bill for {self.data.billing_period_water}")
        lines.append(f"RM ({self.data.water_amount:.2f} / {total_headcount}) = RM {water_cost_per_person:.2f}\n")

        for room in room_summaries:
            lines.append(f"------{room.room_name}------")
            lines.append(f"AC Usage: ({room.curr_meter:.0f} - {room.prev_meter:.0f}) kWh = {room.kwh_used:.0f} kWh")
            lines.append(f"({room.kwh_used:.0f} * {unit_rate:.2f}) = RM {room.total_room_ac_cost:.2f} / {len(room.tenants)} ≈ RM {room.per_tenant_ac_cost:.2f} per person\n")
            
            for t in room.tenants:
                t_b = next((b for b in tenant_breakdowns if b.tenant_name == t and b.room_name == room.room_name), None)
                if t_b:
                    lines.append(f"{t:10} : RM ({t_b.common_electric:.2f} + {t_b.room_ac:.2f} + {t_b.water:.2f}) ≈ RM {t_b.total:.2f}")
            lines.append("")

        calc_sum_parts = " + ".join(f"{b.total:.2f}" for b in tenant_breakdowns)
        lines.append(f"Total : RM ({calc_sum_parts}) = {total_collected:.2f}")
        lines.append(f"Actual : RM {actual_payable:.2f}")
        lines.append(f"Collected : RM {total_collected:.2f}")
        lines.append(f"\nBalance : RM {next_month_balance:.2f} ➔ use for next month bill deduction before calculation.")
        
        return "\n".join(lines)


# =====================================================================
# Interactive CLI Input Prompter
# =====================================================================

def _prompt_str(prompt_text: str, default: Optional[str] = None) -> str:
    default_str = f" [{default}]" if default is not None else ""
    while True:
        try:
            val = input(f"{prompt_text}{default_str}: ").strip()
            if not val and default is not None:
                return default
            if val:
                return val
            print("  ⚠️  Input cannot be empty. Please try again.")
        except (KeyboardInterrupt, EOFError):
            print("\nOperation cancelled.")
            sys.exit(0)

def _prompt_float(prompt_text: str, default: Optional[float] = None, min_val: float = 0.0) -> float:
    default_str = f" [{default}]" if default is not None else ""
    while True:
        try:
            val = input(f"{prompt_text}{default_str}: ").strip()
            if not val and default is not None:
                return float(default)
            num = float(val)
            if num < min_val:
                print(f"  ⚠️  Value must be >= {min_val}. Please try again.")
                continue
            return num
        except ValueError:
            print("  ⚠️  Invalid number format. Please enter a valid number.")
        except (KeyboardInterrupt, EOFError):
            print("\nOperation cancelled.")
            sys.exit(0)

def _prompt_int(prompt_text: str, default: Optional[int] = None, min_val: int = 1) -> int:
    default_str = f" [{default}]" if default is not None else ""
    while True:
        try:
            val = input(f"{prompt_text}{default_str}: ").strip()
            if not val and default is not None:
                return int(default)
            num = int(val)
            if num < min_val:
                print(f"  ⚠️  Value must be >= {min_val}. Please try again.")
                continue
            return num
        except ValueError:
            print("  ⚠️  Invalid integer. Please enter a whole number.")
        except (KeyboardInterrupt, EOFError):
            print("\nOperation cancelled.")
            sys.exit(0)


def prompt_user_for_bill() -> BillInput:
    """
    Interactively prompts the user for every single input parameter,
    including individual tenant names, room names, meter numbers, and invoices.
    """
    print("\n=======================================================")
    print(" ⚡💧 HOUSE UTILITY BILL CALCULATOR - INTERACTIVE INPUT")
    print("=======================================================\n")

    print("--- [1/3] Utility Invoices & Grid Information ---")
    elec_period = _prompt_str("• Electric bill period / due date", default="12 August 2026")
    water_period = _prompt_str("• Water bill period", default="May to July 2026")
    
    elec_amount = _prompt_float("• Total Electric Bill amount (RM)", default=157.15, min_val=0.0)
    prev_balance = _prompt_float("• Previous balance deduction from last month (RM)", default=2.42, min_val=0.0)
    total_kwh = _prompt_float("• Total Grid Electricity usage (kWh)", default=477.0, min_val=0.1)
    water_amount = _prompt_float("• Total Water Bill amount (RM)", default=7.00, min_val=0.0)

    print("\n--- [2/3] Rate Calculation Strategy ---")
    print("  1) Ceil / Round Up - Standard House Rule [Recommended for rental surplus carryover]")
    print("  2) Manual Fixed Rate")
    rate_choice = _prompt_str("• Choose calculation strategy (1/2)", default="1")

    rate_mode = "ceil"
    custom_rate = None
    if rate_choice == "2":
        rate_mode = "manual"
        custom_rate = _prompt_float("  Enter custom rate (RM / kWh)", default=0.33)

    print("\n--- [3/3] Rooms, AC Meters & Tenant Names ---")
    num_rooms = _prompt_int("• How many rooms / sub-meters in the house?", default=3, min_val=1)

    rooms: List[Room] = []
    for r_idx in range(1, num_rooms + 1):
        print(f"\n  🏠 [Room {r_idx}/{num_rooms}]")
        room_name = _prompt_str(f"    • Room Name / Label", default=f"Room {r_idx}")
        prev_meter = _prompt_float(f"    • Previous AC Meter Reading for '{room_name}'", default=0.0)
        curr_meter = _prompt_float(f"    • Current AC Meter Reading for '{room_name}'", default=prev_meter)

        num_tenants = _prompt_int(f"    • How many tenants stay in '{room_name}'?", default=1, min_val=1)
        tenants: List[str] = []
        for t_idx in range(1, num_tenants + 1):
            t_name = _prompt_str(f"      - Tenant {t_idx} Name in '{room_name}'", default=f"Tenant {t_idx}")
            tenants.append(t_name)

        rooms.append(Room(
            name=room_name,
            prev_meter=prev_meter,
            curr_meter=curr_meter,
            tenants=tenants
        ))

    return BillInput(
        billing_period_electric=elec_period,
        billing_period_water=water_period,
        electric_amount=elec_amount,
        previous_balance=prev_balance,
        total_kwh=total_kwh,
        water_amount=water_amount,
        rooms=rooms,
        rate_mode=rate_mode,
        custom_rate=custom_rate
    )


def run_interactive():
    """Runs the interactive prompter, calculates the split, and outputs the report."""
    bill_input = prompt_user_for_bill()
    calculator = BillCalculator(bill_input)
    result = calculator.calculate()

    print("\n" + "=" * 55)
    print(" ✅ BILL CALCULATION RESULT (WhatsApp / Chat Ready)")
    print("=" * 55 + "\n")
    print(result.summary_report)
    print("=" * 55)

    # Offer to save report
    save_choice = _prompt_str("\nWould you like to save this report to a text file? (y/n)", default="n")
    if save_choice.lower().startswith("y"):
        filename = _prompt_str("Enter filename", default="bill_summary.txt")
        try:
            with open(filename, "w", encoding="utf-8") as f:
                f.write(result.summary_report)
            print(f"  ✨ Report saved to '{filename}' successfully!")
        except Exception as e:
            print(f"  ❌ Error saving file: {e}")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in ("--sample", "-s"):
        # Run with default reference sample
        sample_input = BillInput(
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
        calc = BillCalculator(sample_input)
        res = calc.calculate()
        print(res.summary_report)
    else:
        run_interactive()
