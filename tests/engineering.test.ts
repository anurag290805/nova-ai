import { describe, expect, it } from "vitest";

import {
  calculateMechanicalPower,
  calculateRotationalMechanicalPower,
  calculatePercentageImprovement,
  evaluateArithmetic,
  MathExpressionError,
} from "@/lib/engineering/calculations";
import { analyzeSolarTracking } from "@/lib/engineering/solar";
import { ENGINEERING_UNITS, parseEngineeringValue } from "@/lib/engineering/units";
import { executeTool } from "@/lib/tools/registry";

describe("bounded engineering calculations", () => {
  it("evaluates arithmetic without executing code", () => {
    expect(evaluateArithmetic("(12 + 8) * 2.5")).toBe(50);
    expect(evaluateArithmetic("12.5%")).toBe(0.125);
    expect(evaluateArithmetic("12 + 5%")).toBeCloseTo(12.05, 8);
    expect(() => evaluateArithmetic("globalThis.process" )).toThrow(MathExpressionError);
    expect(() => evaluateArithmetic("10 / 0")).toThrow("Division by zero");
  });

  it("calculates mechanical power with explicit efficiency", () => {
    const result = calculateMechanicalPower({ forceN: 420, velocityMps: 1.8, efficiencyPct: 82 });
    expect(result.idealPowerKw).toBeCloseTo(0.756, 5);
    expect(result.usefulPowerKw).toBeCloseTo(0.61992, 5);
  });

  it("calculates rotational power from torque and RPM", () => {
    const result = calculateRotationalMechanicalPower({ torqueNm: 50, rpm: 1_500 });
    expect(result.idealPowerKw).toBeCloseTo(7.85398, 4);
    expect(result.usefulPowerKw).toBeCloseTo(7.85398, 4);
  });

  it("rejects a zero baseline and computes a valid comparison", () => {
    expect(calculatePercentageImprovement({ baseline: 100, improved: 116 }).percentageChange).toBe(16);
    expect(() => calculatePercentageImprovement({ baseline: 0, improved: 1 })).toThrow("Baseline");
  });

  it("keeps solar scenarios aligned to the same baseline model", () => {
    const result = analyzeSolarTracking({
      panelAreaM2: 10,
      panelEfficiencyPct: 20,
      annualIrradianceKwhM2: 1_500,
      performanceRatioPct: 78,
      ratedPowerKw: 2,
      singleAxisGainPct: 12,
      dualAxisGainPct: 22,
      singleAxisPenaltyPct: 2,
      dualAxisPenaltyPct: 5,
    });
    expect(result.scenarios.map((scenario) => scenario.id)).toEqual(["fixed", "single-axis", "dual-axis"]);
    expect(result.scenarios[0].annualEnergyKwh).toBe(2_340);
    expect(result.scenarios[2].annualEnergyKwh).toBeCloseTo(2_712.06, 5);
    expect(result.scenarios[2].netGainPct).toBeCloseTo(15.9, 1);
    expect(result.assumptions.length).toBeGreaterThan(2);
  });

  it("validates tool inputs before dispatch", async () => {
    const invalid = await executeTool("mechanical_power", { forceN: -1, velocityMps: 1, efficiencyPct: 80 });
    expect(invalid.status).toBe("failed");
    expect(invalid.summary).toContain("validation");
    const numericStrings = await executeTool("calculate_mechanical_power", { torqueNm: "50", rpm: "1500" });
    expect(numericStrings.status).toBe("completed");
    const invalidNumericString = await executeTool("calculate_mechanical_power", { torqueNm: "50 N", rpm: "1500" });
    expect(invalidNumericString.status).toBe("failed");
  });

  it("normalizes supported engineering units into canonical values", () => {
    expect(parseEngineeringValue("1500 rpm", ENGINEERING_UNITS.rpm, "rpm").value).toBe(1_500);
    expect(parseEngineeringValue("10 m²", ENGINEERING_UNITS.areaM2, "panelAreaM2").value).toBe(10);
    expect(parseEngineeringValue("20%", ENGINEERING_UNITS.efficiencyPct, "efficiencyPct").value).toBe(20);
    expect(parseEngineeringValue("5 kW", ENGINEERING_UNITS.powerKw, "powerKw").value).toBe(5);
  });

  it("rejects incompatible dimensions, ambiguous percentages, and nonfinite values", () => {
    expect(parseEngineeringValue("1500 rpm", ENGINEERING_UNITS.areaM2, "panelAreaM2").issue?.code).toBe("incompatible_unit");
    expect(parseEngineeringValue("20% of output", ENGINEERING_UNITS.efficiencyPct, "efficiencyPct").issue?.code).toBe("ambiguous_unit");
    expect(parseEngineeringValue("1e309", ENGINEERING_UNITS.powerKw, "powerKw").issue?.code).toBe("invalid_number");
  });

  it("runs solar analysis with normalized unit-bearing arguments", async () => {
    const result = await executeTool("solar_tracking_analysis", {
      panelAreaM2: "10 m²",
      panelEfficiencyPct: "20%",
      annualIrradianceKwhM2: "1500 kWh/m²",
      performanceRatioPct: "78%",
      ratedPowerKw: "2 kW",
      singleAxisGainPct: "12%",
      dualAxisGainPct: "22%",
      singleAxisPenaltyPct: "2%",
      dualAxisPenaltyPct: "5%",
    });
    expect(result.status).toBe("completed");
    expect(result.data).toMatchObject({ input: { panelAreaM2: 10, annualIrradianceKwhM2: 1_500 } });
  });
});
