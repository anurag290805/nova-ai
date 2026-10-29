import { z } from "zod";

const finiteNumber = z.number().finite();

export const mechanicalPowerInputSchema = z.object({
  forceN: finiteNumber.gt(0),
  velocityMps: finiteNumber.gte(0),
  efficiencyPct: finiteNumber.gt(0).lte(100),
}).strict();

export type MechanicalPowerInput = z.infer<typeof mechanicalPowerInputSchema>;

export function calculateMechanicalPower(input: MechanicalPowerInput) {
  const parsed = mechanicalPowerInputSchema.parse(input);
  const idealPowerKw = (parsed.forceN * parsed.velocityMps) / 1000;
  return {
    idealPowerKw,
    usefulPowerKw: idealPowerKw * (parsed.efficiencyPct / 100),
    lossesKw: idealPowerKw * (1 - parsed.efficiencyPct / 100),
    units: "kW",
  };
}

export const rotationalMechanicalPowerInputSchema = z.object({
  torqueNm: finiteNumber.gt(0),
  rpm: finiteNumber.gte(0),
  efficiencyPct: finiteNumber.gt(0).lte(100).default(100),
}).strict();

export type RotationalMechanicalPowerInput = z.infer<typeof rotationalMechanicalPowerInputSchema>;

export function calculateRotationalMechanicalPower(input: RotationalMechanicalPowerInput) {
  const parsed = rotationalMechanicalPowerInputSchema.parse(input);
  const angularVelocityRadPerSecond = (parsed.rpm * 2 * Math.PI) / 60;
  const idealPowerKw = (parsed.torqueNm * angularVelocityRadPerSecond) / 1000;
  return {
    torqueNm: parsed.torqueNm,
    rpm: parsed.rpm,
    angularVelocityRadPerSecond,
    idealPowerKw,
    usefulPowerKw: idealPowerKw * (parsed.efficiencyPct / 100),
    lossesKw: idealPowerKw * (1 - parsed.efficiencyPct / 100),
    units: "kW",
  };
}

export const energyProductionInputSchema = z.object({
  powerKw: finiteNumber.gt(0),
  hoursPerDay: finiteNumber.gt(0).lte(24),
  daysPerYear: finiteNumber.gt(0).lte(366),
  capacityFactorPct: finiteNumber.gt(0).lte(100),
}).strict();

export type EnergyProductionInput = z.infer<typeof energyProductionInputSchema>;

export function calculateEnergyProduction(input: EnergyProductionInput) {
  const parsed = energyProductionInputSchema.parse(input);
  const theoreticalKwh = parsed.powerKw * parsed.hoursPerDay * parsed.daysPerYear;
  return {
    powerKw: parsed.powerKw,
    hoursPerDay: parsed.hoursPerDay,
    daysPerYear: parsed.daysPerYear,
    capacityFactorPct: parsed.capacityFactorPct,
    theoreticalKwh,
    estimatedKwh: theoreticalKwh * (parsed.capacityFactorPct / 100),
    units: "kWh/year",
  };
}

export const operatingEnergyInputSchema = z.object({
  powerKw: finiteNumber.gt(0),
  hoursPerDay: finiteNumber.gt(0).lte(24),
  days: finiteNumber.gt(0).lte(366),
}).strict();

export type OperatingEnergyInput = z.infer<typeof operatingEnergyInputSchema>;

export function calculateOperatingEnergy(input: OperatingEnergyInput) {
  const parsed = operatingEnergyInputSchema.parse(input);
  const operatingHours = parsed.hoursPerDay * parsed.days;
  return {
    powerKw: parsed.powerKw,
    hoursPerDay: parsed.hoursPerDay,
    days: parsed.days,
    operatingHours,
    energyKwh: parsed.powerKw * operatingHours,
    units: "kWh",
  };
}

export const percentageImprovementInputSchema = z.object({
  baseline: finiteNumber.gte(0),
  improved: finiteNumber.gte(0),
}).strict();

export type PercentageImprovementInput = z.infer<typeof percentageImprovementInputSchema>;

export function calculatePercentageImprovement(input: PercentageImprovementInput) {
  const parsed = percentageImprovementInputSchema.parse(input);
  if (parsed.baseline === 0) {
    throw new Error("Baseline must be greater than zero to calculate a percentage improvement.");
  }
  return {
    absoluteChange: parsed.improved - parsed.baseline,
    percentageChange: ((parsed.improved - parsed.baseline) / parsed.baseline) * 100,
  };
}

export const costComparisonInputSchema = z.object({
  optionA: finiteNumber.gte(0),
  optionB: finiteNumber.gte(0),
  optionAName: z.string().trim().min(1).max(80),
  optionBName: z.string().trim().min(1).max(80),
}).strict();

export type CostComparisonInput = z.infer<typeof costComparisonInputSchema>;

export function calculateCostComparison(input: CostComparisonInput) {
  const parsed = costComparisonInputSchema.parse(input);
  const difference = parsed.optionB - parsed.optionA;
  return {
    cheaperOption: difference > 0 ? parsed.optionAName : difference < 0 ? parsed.optionBName : "Equal",
    difference: Math.abs(difference),
    optionA: parsed.optionA,
    optionB: parsed.optionB,
  };
}

export class MathExpressionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MathExpressionError";
  }
}

type Token = { type: "number" | "operator" | "left" | "right" | "percent" | "end"; value: string };

function tokenize(expression: string): Token[] {
  if (expression.length > 200) throw new MathExpressionError("Expression is limited to 200 characters.");
  const tokens: Token[] = [];
  let index = 0;
  while (index < expression.length) {
    const character = expression[index];
    if (/\s/.test(character)) {
      index += 1;
      continue;
    }
    if (/[0-9.]/.test(character)) {
      const match = expression.slice(index).match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
      if (!match) throw new MathExpressionError(`Invalid number at position ${index}.`);
      tokens.push({ type: "number", value: match[0] });
      index += match[0].length;
      continue;
    }
    if ("+-*/^".includes(character)) tokens.push({ type: "operator", value: character });
    else if (character === "(") tokens.push({ type: "left", value: character });
    else if (character === ")") tokens.push({ type: "right", value: character });
    else if (character === "%") tokens.push({ type: "percent", value: character });
    else throw new MathExpressionError(`Unsupported character '${character}'.`);
    index += 1;
  }
  tokens.push({ type: "end", value: "" });
  return tokens;
}

export function evaluateArithmetic(expression: string): number {
  const tokens = tokenize(expression.trim());
  let position = 0;
  const peek = () => tokens[position];
  const consume = () => tokens[position++];

  function primary(): number {
    const token = consume();
    if (token.type === "number") return Number(token.value);
    if (token.type === "left") {
      const value = additive();
      if (consume().type !== "right") throw new MathExpressionError("Missing closing parenthesis.");
      return value;
    }
    if (token.type === "operator" && (token.value === "+" || token.value === "-")) {
      const value = primary();
      return token.value === "-" ? -value : value;
    }
    throw new MathExpressionError("Expected a number or opening parenthesis.");
  }

  function power(): number {
    let left = primary();
    if (peek().type === "percent") {
      consume();
      left /= 100;
    }
    if (peek().type === "operator" && peek().value === "^") {
      consume();
      return Math.pow(left, power());
    }
    return left;
  }

  function multiplicative(): number {
    let value = power();
    while (peek().type === "operator" && (peek().value === "*" || peek().value === "/")) {
      const operator = consume().value;
      const right = power();
      if (operator === "/" && right === 0) throw new MathExpressionError("Division by zero is not allowed.");
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  }

  function additive(): number {
    let value = multiplicative();
    while (peek().type === "operator" && (peek().value === "+" || peek().value === "-")) {
      const operator = consume().value;
      const right = multiplicative();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  const result = additive();
  if (peek().type !== "end") throw new MathExpressionError("Unexpected token after expression.");
  return ensureFinite(result);
}

function ensureFinite(value: number): number {
  if (!Number.isFinite(value)) throw new MathExpressionError("The calculation produced a non-finite result.");
  return value;
}
