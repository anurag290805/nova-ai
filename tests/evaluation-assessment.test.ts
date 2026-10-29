import { describe, expect, it } from "vitest";

import { assessEvaluationCase } from "../scripts/evaluation-assessment.mjs";

describe("evaluation assessment", () => {
  it("requires the expected tools and grounded numerical values in addition to a matching completed status", () => {
    const assessment = assessEvaluationCase(
      {
        expectedStatus: "completed",
        expectedTools: ["calculate_mechanical_power", "operating_energy"],
        expectedNumerics: [{ toolName: "operating_energy", path: "energyKwh", expected: 1413.72, tolerance: 0.01 }],
      },
      {
        status: "completed",
        toolResults: [
          { toolName: "calculate_mechanical_power", data: { usefulPowerKw: 7.85398 } },
          { toolName: "operating_energy", data: { energyKwh: 1413.7167 } },
        ],
      },
    );

    expect(assessment.expectedStatusMatched).toBe(true);
    expect(assessment.expectedToolsMatched).toBe(true);
    expect(assessment.numericalCorrect).toBe(true);
    expect(assessment.successfulCompletion).toBe(true);
  });

  it("does not treat a matching status as success when the selected tool is wrong", () => {
    const assessment = assessEvaluationCase(
      { expectedStatus: "completed", expectedTools: ["safe_math"] },
      { status: "completed", toolResults: [{ toolName: "percentage_improvement", data: { percentageChange: 100 } }] },
    );

    expect(assessment.expectedStatusMatched).toBe(true);
    expect(assessment.expectedToolsMatched).toBe(false);
    expect(assessment.successfulCompletion).toBe(false);
  });
});
