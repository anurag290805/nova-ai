import { z } from "zod";

import {
  calculateCostComparison,
  calculateEnergyProduction,
  calculateMechanicalPower,
  calculateRotationalMechanicalPower,
  calculatePercentageImprovement,
  costComparisonInputSchema,
  energyProductionInputSchema,
  mechanicalPowerInputSchema,
  rotationalMechanicalPowerInputSchema,
  percentageImprovementInputSchema,
  evaluateArithmetic,
} from "@/lib/engineering/calculations";
import { analyzeSolarTracking, solarInputSchema } from "@/lib/engineering/solar";
import { ENGINEERING_UNITS, normalizeEngineeringFields } from "@/lib/engineering/units";

import { researchOpenTool, researchSearchTool } from "./research";
import type { ToolContext, ToolDefinition, ToolExecution } from "./types";

const safeMathSchema = z.object({ expression: z.string().trim().min(1).max(200) });

const tools: ToolDefinition[] = [
  {
    name: "safe_math",
    description: "Evaluate bounded arithmetic with +, -, *, /, ^, parentheses, and percentage postfix notation.",
    permission: "read-only",
    inputSchema: safeMathSchema,
    modelInput: {
      type: "object",
      properties: { expression: { type: "string", description: "Arithmetic expression; no code or function calls" } },
      required: ["expression"],
    },
    async execute(input) {
      const parsed = safeMathSchema.parse(input);
      return { expression: parsed.expression, value: evaluateArithmetic(parsed.expression), units: "scalar" };
    },
  },
  {
    name: "mechanical_power",
    description: "Calculate ideal and useful mechanical power from force, velocity, and efficiency.",
    permission: "read-only",
    inputSchema: mechanicalPowerInputSchema,
    numericFields: {
      forceN: ENGINEERING_UNITS.forceN,
      velocityMps: ENGINEERING_UNITS.velocityMps,
      efficiencyPct: ENGINEERING_UNITS.efficiencyPct,
    },
    modelInput: {
      type: "object",
      properties: {
        forceN: { type: "number", description: "Force in newtons; bare number, example 420" },
        velocityMps: { type: "number", description: "Velocity in metres per second; bare number, example 1.8" },
        efficiencyPct: { type: "number", description: "Efficiency from 0 to 100 percent; bare number, example 82" },
      },
      required: ["forceN", "velocityMps", "efficiencyPct"],
    },
    async execute(input) {
      return calculateMechanicalPower(mechanicalPowerInputSchema.parse(input));
    },
  },
  {
    name: "calculate_mechanical_power",
    description: "Calculate rotational mechanical power from torque in newton-metres and rotational speed in RPM.",
    permission: "read-only",
    inputSchema: rotationalMechanicalPowerInputSchema,
    numericFields: {
      torqueNm: ENGINEERING_UNITS.torqueNm,
      rpm: ENGINEERING_UNITS.rpm,
      efficiencyPct: ENGINEERING_UNITS.efficiencyPct,
    },
    modelInput: {
      type: "object",
      properties: {
        torqueNm: { type: "number", description: "Torque in newton-metres; bare number, example 50" },
        rpm: { type: "number", description: "Rotational speed in revolutions per minute; bare number, example 1500" },
        efficiencyPct: { type: "number", description: "Optional efficiency from 0 to 100 percent; bare number, example 82; defaults to 100" },
      },
      required: ["torqueNm", "rpm"],
    },
    async execute(input) {
      return calculateRotationalMechanicalPower(rotationalMechanicalPowerInputSchema.parse(input));
    },
  },
  {
    name: "energy_production",
    description: "Estimate annual energy from rated power, operating hours, days, and capacity factor.",
    permission: "read-only",
    inputSchema: energyProductionInputSchema,
    numericFields: {
      powerKw: ENGINEERING_UNITS.powerKw,
      hoursPerDay: ENGINEERING_UNITS.timeHours,
      daysPerYear: ENGINEERING_UNITS.timeDays,
      capacityFactorPct: ENGINEERING_UNITS.efficiencyPct,
    },
    modelInput: {
      type: "object",
      properties: {
        powerKw: { type: "number", description: "Power in kW exactly as stated; bare number, example 5; do not convert to watts" },
        hoursPerDay: { type: "number", description: "Operating hours per day as a bare number, example 6" },
        daysPerYear: { type: "number", description: "Operating days per year as a bare number, example 365" },
        capacityFactorPct: { type: "number", description: "Capacity factor as a number from 0 to 100, example 20; do not include the percent sign" },
      },
      required: ["powerKw", "hoursPerDay", "daysPerYear", "capacityFactorPct"],
    },
    async execute(input) {
      return calculateEnergyProduction(energyProductionInputSchema.parse(input));
    },
  },
  {
    name: "percentage_improvement",
    description: "Compare a baseline and improved value, returning absolute and percentage change.",
    permission: "read-only",
    inputSchema: percentageImprovementInputSchema,
    numericFields: { baseline: ENGINEERING_UNITS.dimensionless, improved: ENGINEERING_UNITS.dimensionless },
    modelInput: {
      type: "object",
      properties: {
        baseline: { type: "number", description: "Baseline value" },
        improved: { type: "number", description: "Improved value" },
      },
      required: ["baseline", "improved"],
    },
    async execute(input) {
      return calculatePercentageImprovement(percentageImprovementInputSchema.parse(input));
    },
  },
  {
    name: "cost_comparison",
    description: "Compare two non-negative costs and identify the lower-cost option.",
    permission: "read-only",
    inputSchema: costComparisonInputSchema,
    numericFields: { optionA: ENGINEERING_UNITS.currency, optionB: ENGINEERING_UNITS.currency },
    modelInput: {
      type: "object",
      properties: {
        optionA: { type: "number", description: "Cost of option A" },
        optionB: { type: "number", description: "Cost of option B" },
        optionAName: { type: "string", description: "Name of option A" },
        optionBName: { type: "string", description: "Name of option B" },
      },
      required: ["optionA", "optionB", "optionAName", "optionBName"],
    },
    async execute(input) {
      return calculateCostComparison(costComparisonInputSchema.parse(input));
    },
  },
  {
    name: "solar_tracking_analysis",
    description: "Estimate fixed, single-axis, and dual-axis solar output from explicit scenario assumptions.",
    permission: "read-only",
    inputSchema: solarInputSchema,
    numericFields: {
      panelAreaM2: ENGINEERING_UNITS.areaM2,
      panelEfficiencyPct: ENGINEERING_UNITS.efficiencyPct,
      annualIrradianceKwhM2: ENGINEERING_UNITS.irradianceKwhM2,
      performanceRatioPct: ENGINEERING_UNITS.efficiencyPct,
      ratedPowerKw: ENGINEERING_UNITS.powerKw,
      singleAxisGainPct: ENGINEERING_UNITS.efficiencyPct,
      dualAxisGainPct: ENGINEERING_UNITS.efficiencyPct,
      singleAxisPenaltyPct: ENGINEERING_UNITS.efficiencyPct,
      dualAxisPenaltyPct: ENGINEERING_UNITS.efficiencyPct,
    },
    modelInput: {
      type: "object",
      properties: {
        panelAreaM2: { type: "number", description: "Panel area in square metres, bare number, example 10" },
        panelEfficiencyPct: { type: "number", description: "Panel efficiency from 0 to 100, bare number without percent sign, example 20" },
        annualIrradianceKwhM2: { type: "number", description: "Annual irradiance in kWh per square metre, bare number, example 1500" },
        performanceRatioPct: { type: "number", description: "Performance ratio from 0 to 100, bare number without percent sign, example 78" },
        ratedPowerKw: { type: "number", description: "Array rated power in kW, bare number, example 2; do not convert units" },
        singleAxisGainPct: { type: "number", description: "Single-axis gross gain from 0 to 100, bare number without percent sign, example 12" },
        dualAxisGainPct: { type: "number", description: "Dual-axis gross gain from 0 to 100, bare number without percent sign, example 22" },
        singleAxisPenaltyPct: { type: "number", description: "Single-axis penalty from 0 to 100, bare number without percent sign, example 2" },
        dualAxisPenaltyPct: { type: "number", description: "Dual-axis penalty from 0 to 100, bare number without percent sign, example 5" },
      },
      required: [
        "panelAreaM2",
        "panelEfficiencyPct",
        "annualIrradianceKwhM2",
        "performanceRatioPct",
        "ratedPowerKw",
        "singleAxisGainPct",
        "dualAxisGainPct",
        "singleAxisPenaltyPct",
        "dualAxisPenaltyPct",
      ],
    },
    async execute(input) {
      return analyzeSolarTracking(solarInputSchema.parse(input));
    },
  },
  researchSearchTool,
  researchOpenTool,
];

export const toolRegistry = Object.freeze(tools);

export function getTool(name: string) {
  return toolRegistry.find((tool) => tool.name === name);
}

export function getModelTools(toolNames?: readonly string[]) {
  const availableTools = toolNames ? toolRegistry.filter((tool) => toolNames.includes(tool.name)) : toolRegistry;
  return availableTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.modelInput,
  }));
}

export async function executeTool(name: string, rawInput: unknown, context: ToolContext = {}): Promise<ToolExecution> {
  const tool = getTool(name);
  if (!tool) return { toolName: name, status: "failed", summary: "Tool is not registered.", error: "Unknown tool." };
  const normalized = normalizeEngineeringFields(rawInput, tool.numericFields ?? {});
  if (normalized.issues.length) {
    return {
      toolName: name,
      status: "failed",
      summary: "Tool input validation failed.",
      error: JSON.stringify(normalized.issues),
      validationIssues: normalized.issues,
    };
  }
  const parsed = tool.inputSchema.safeParse(normalized.value);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({
      code: "invalid_type" as const,
      field: issue.path.join("."),
      received: rawInput,
      expectedUnit: "schema",
      expectedDimension: "dimensionless" as const,
      message: issue.message,
    }));
    return {
      toolName: name,
      status: "failed",
      summary: "Tool input validation failed.",
      error: JSON.stringify(issues),
      validationIssues: issues,
    };
  }
  try {
    const data = await tool.execute(parsed.data, context);
    return { toolName: name, status: "completed", summary: summarizeToolResult(name, data), data };
  } catch (error) {
    return {
      toolName: name,
      status: "failed",
      summary: "Tool execution failed safely.",
      error: error instanceof Error ? error.message : "Unknown tool failure.",
    };
  }
}

function summarizeToolResult(name: string, data: unknown) {
  if (name === "solar_tracking_analysis" && isSolarResult(data)) {
    const dual = data.scenarios.find((scenario) => scenario.id === "dual-axis");
    return dual ? `Compared three solar scenarios; dual-axis estimate is ${format(dual.annualEnergyKwh)} kWh/year.` : "Solar scenarios compared.";
  }
  if (name === "research_search" && isResearchResult(data)) return `Retrieved ${data.sources.length} source reference(s) from Crossref.`;
  if (name === "safe_math" && isMathResult(data)) return `Calculated ${format(data.value)} as a bounded scalar result.`;
  return `${name} completed with structured output.`;
}

function format(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function isSolarResult(value: unknown): value is { scenarios: Array<{ id: string; annualEnergyKwh: number }> } {
  return typeof value === "object" && value !== null && "scenarios" in value && Array.isArray(value.scenarios);
}

function isResearchResult(value: unknown): value is { sources: unknown[] } {
  return typeof value === "object" && value !== null && "sources" in value && Array.isArray(value.sources);
}

function isMathResult(value: unknown): value is { value: number } {
  return typeof value === "object" && value !== null && "value" in value && typeof value.value === "number";
}
