import { z } from "zod";

const percentage = z.number().finite().gte(0).lte(100);

export const solarInputSchema = z.object({
  panelAreaM2: z.number().finite().gt(0).lte(100_000),
  panelEfficiencyPct: percentage.refine((value) => value > 0, "Panel efficiency must be greater than zero."),
  annualIrradianceKwhM2: z.number().finite().gt(0).lte(5_000),
  performanceRatioPct: percentage.refine((value) => value > 0, "Performance ratio must be greater than zero."),
  ratedPowerKw: z.number().finite().gt(0).lte(10_000),
  singleAxisGainPct: percentage,
  dualAxisGainPct: percentage,
  singleAxisPenaltyPct: percentage,
  dualAxisPenaltyPct: percentage,
}).strict();

export type SolarInput = z.infer<typeof solarInputSchema>;

export type SolarScenario = {
  id: "fixed" | "single-axis" | "dual-axis";
  label: string;
  annualEnergyKwh: number;
  grossGainPct: number;
  operatingPenaltyPct: number;
  netGainPct: number;
  deltaFromFixedKwh: number;
};

export type SolarAnalysis = {
  input: SolarInput;
  scenarios: SolarScenario[];
  assumptions: string[];
  warnings: string[];
  model: string;
};

export const solarAssumptions = [
  "Annual energy = area × annual irradiance × panel efficiency × performance ratio.",
  "Tracking gain is an adjustable scenario assumption, not a universal industry constant.",
  "Operating penalties are applied after gross tracking gain to represent additional energy use and maintenance burden.",
  "The simplified model does not replace a location-specific photovoltaic simulation or structural review.",
] as const;

export function analyzeSolarTracking(input: SolarInput): SolarAnalysis {
  const parsed = solarInputSchema.parse(input);
  const fixedEnergy =
    parsed.panelAreaM2 *
    parsed.annualIrradianceKwhM2 *
    (parsed.panelEfficiencyPct / 100) *
    (parsed.performanceRatioPct / 100);

  const scenarios = [
    createScenario("fixed", "Fixed panel", fixedEnergy, 0, 0),
    createScenario(
      "single-axis",
      "Single-axis tracking",
      fixedEnergy,
      parsed.singleAxisGainPct,
      parsed.singleAxisPenaltyPct,
    ),
    createScenario("dual-axis", "Dual-axis tracking", fixedEnergy, parsed.dualAxisGainPct, parsed.dualAxisPenaltyPct),
  ];

  const warnings: string[] = [];
  const estimatedCapacityFactor = fixedEnergy / (parsed.ratedPowerKw * 8_760);
  if (estimatedCapacityFactor > 1) {
    warnings.push("The estimated fixed-panel energy exceeds the rated-power annual ceiling; review inputs.");
  }
  if (parsed.dualAxisGainPct < parsed.singleAxisGainPct) {
    warnings.push("Dual-axis gain is below single-axis gain; this may be intentional but should be reviewed.");
  }
  const nominalRatedPowerKw = parsed.panelAreaM2 * (parsed.panelEfficiencyPct / 100);
  if (parsed.ratedPowerKw > nominalRatedPowerKw * 3 || parsed.ratedPowerKw < nominalRatedPowerKw * 0.1) {
    warnings.push("Rated power is physically inconsistent with panel area and efficiency under a 1 kW/m² nominal reference; review the inputs.");
  }
  if (parsed.singleAxisPenaltyPct >= 95 || parsed.dualAxisPenaltyPct >= 95) {
    warnings.push("A tracking operating penalty at or above 95% makes the scenario nearly non-producing; verify the assumption.");
  }

  return {
    input: parsed,
    scenarios,
    assumptions: [...solarAssumptions],
    warnings,
    model: "Deterministic first-order photovoltaic scenario estimate",
  };
}

function createScenario(
  id: SolarScenario["id"],
  label: string,
  fixedEnergy: number,
  grossGainPct: number,
  operatingPenaltyPct: number,
): SolarScenario {
  const annualEnergyKwh = fixedEnergy * (1 + grossGainPct / 100) * (1 - operatingPenaltyPct / 100);
  return {
    id,
    label,
    annualEnergyKwh,
    grossGainPct,
    operatingPenaltyPct,
    netGainPct: ((annualEnergyKwh - fixedEnergy) / fixedEnergy) * 100,
    deltaFromFixedKwh: annualEnergyKwh - fixedEnergy,
  };
}
