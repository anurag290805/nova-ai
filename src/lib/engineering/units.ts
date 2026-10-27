export type EngineeringDimension =
  | "area"
  | "count"
  | "currency"
  | "dimensionless"
  | "force"
  | "irradiance"
  | "percentage"
  | "power"
  | "speed"
  | "time-days"
  | "time-hours"
  | "torque"
  | "velocity";

export type EngineeringUnitSpec = {
  dimension: EngineeringDimension;
  canonicalUnit: string;
  aliases: Readonly<Record<string, number>>;
  allowUnitless: boolean;
};

export type EngineeringValueIssue = {
  code: "invalid_type" | "invalid_number" | "unknown_unit" | "incompatible_unit" | "ambiguous_unit";
  field: string;
  received: unknown;
  expectedUnit: string;
  expectedDimension: EngineeringDimension;
  message: string;
};

export type EngineeringNormalization = {
  value: unknown;
  issues: EngineeringValueIssue[];
};

const unitSpec = (
  dimension: EngineeringDimension,
  canonicalUnit: string,
  aliases: Readonly<Record<string, number>> = {},
  allowUnitless = true,
): EngineeringUnitSpec => ({ dimension, canonicalUnit, aliases, allowUnitless });

export const ENGINEERING_UNITS = {
  areaM2: unitSpec("area", "m²", { m2: 1, sqm: 1 }),
  count: unitSpec("count", "count"),
  currency: unitSpec("currency", "cost units"),
  dimensionless: unitSpec("dimensionless", "scalar"),
  efficiencyPct: unitSpec("percentage", "%", { "%": 1 }, true),
  forceN: unitSpec("force", "N", { n: 1 }),
  irradianceKwhM2: unitSpec("irradiance", "kWh/m²", { "kwh/m2": 1 }),
  powerKw: unitSpec("power", "kW", { kw: 1 }),
  rpm: unitSpec("speed", "rpm", { rpm: 1 }),
  timeDays: unitSpec("time-days", "day", { day: 1, d: 1 }),
  timeHours: unitSpec("time-hours", "h", { h: 1 }),
  torqueNm: unitSpec("torque", "N·m", { nm: 1 }),
  velocityMps: unitSpec("velocity", "m/s", { "m/s": 1 }),
} as const satisfies Record<string, EngineeringUnitSpec>;

export function normalizeEngineeringFields(
  rawInput: unknown,
  fields: Readonly<Record<string, EngineeringUnitSpec>>,
): EngineeringNormalization {
  if (typeof rawInput !== "object" || rawInput === null || Array.isArray(rawInput)) {
    return {
      value: rawInput,
      issues: Object.entries(fields).map(([field, spec]) => ({
        code: "invalid_type",
        field,
        received: rawInput,
        expectedUnit: spec.canonicalUnit,
        expectedDimension: spec.dimension,
        message: `${field} must be a structured value with canonical unit ${spec.canonicalUnit}.`,
      })),
    };
  }

  const normalized: Record<string, unknown> = { ...rawInput };
  const issues: EngineeringValueIssue[] = [];
  for (const [field, spec] of Object.entries(fields)) {
    if (!(field in normalized)) continue;
    const parsed = parseEngineeringValue(normalized[field], spec, field);
    if (parsed.issue) issues.push(parsed.issue);
    else normalized[field] = parsed.value;
  }
  return { value: normalized, issues };
}

export function parseEngineeringValue(value: unknown, spec: EngineeringUnitSpec, field = "value") {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { issue: issue("invalid_number", field, value, spec, `${field} must be finite.`) };
    return { value };
  }

  if (typeof value !== "string") return { issue: issue("invalid_type", field, value, spec, `${field} must be a finite number or a supported unit string.`) };
  const input = value.trim();
  const match = input.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?)\s*(.*?)$/i);
  if (!match) return { issue: issue("invalid_number", field, value, spec, `${field} must contain one finite numeric value.`) };

  const numericValue = Number(match[1]);
  if (!Number.isFinite(numericValue)) return { issue: issue("invalid_number", field, value, spec, `${field} must be finite.`) };
  const rawUnit = match[2].trim();
  if (!rawUnit) {
    if (!spec.allowUnitless) return { issue: issue("ambiguous_unit", field, value, spec, `${field} requires an explicit ${spec.canonicalUnit} unit.`) };
    return { value: numericValue };
  }

  const normalizedUnit = normalizeUnit(rawUnit);
  const factor = spec.aliases[normalizedUnit];
  if (factor === undefined) {
    const ambiguousPercentage = spec.dimension === "percentage" && normalizedUnit.startsWith("%");
    const knownUnit = Object.values(ENGINEERING_UNITS).some((unit) => normalizedUnit in unit.aliases);
    return {
      issue: issue(
        ambiguousPercentage ? "ambiguous_unit" : knownUnit ? "incompatible_unit" : "unknown_unit",
        field,
        value,
        spec,
        `${field} expects ${spec.canonicalUnit} (${spec.dimension}); received unsupported unit '${rawUnit}'.`,
      ),
    };
  }
  const converted = numericValue * factor;
  if (!Number.isFinite(converted)) return { issue: issue("invalid_number", field, value, spec, `${field} conversion produced a non-finite value.`) };
  return { value: converted };
}

function normalizeUnit(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/²/g, "2")
    .replace(/[·⋅]/g, "")
    .replace(/\b(square\s*(?:metre|meter)s?)\b/g, "m2")
    .replace(/\b(?:metre|meter)s?\b/g, "m")
    .replace(/\b(?:kilowatt)\s*hours?\b/g, "kwh")
    .replace(/\bkilowatts?\b/g, "kw")
    .replace(/\bnewton\s*met(?:re|er)s?\b/g, "nm")
    .replace(/\bnewtons?\b/g, "n")
    .replace(/\brevolutions?\s*(?:per|\/)\s*minutes?\b/g, "rpm")
    .replace(/\b(?:hours?|hrs?)\b/g, "h")
    .replace(/\bdays?\b/g, "day")
    .replace(/\bpercent(?:age)?\b/g, "%")
    .replace(/\s+/g, "")
    .trim();
}

function issue(
  code: EngineeringValueIssue["code"],
  field: string,
  received: unknown,
  spec: EngineeringUnitSpec,
  message: string,
): EngineeringValueIssue {
  return { code, field, received, expectedUnit: spec.canonicalUnit, expectedDimension: spec.dimension, message };
}
