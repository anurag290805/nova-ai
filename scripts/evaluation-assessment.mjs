function getNumericValue(value, path) {
  const segments = path.split(".");
  let current = value;
  for (const segment of segments) {
    if (typeof current !== "object" || current === null || !(segment in current)) return undefined;
    current = current[segment];
  }
  return typeof current === "number" && Number.isFinite(current) ? current : undefined;
}

export function assessEvaluationCase(expectation, observed) {
  const actualTools = observed.toolResults.map((tool) => tool.toolName);
  const expectedToolsMatched = expectation.expectedTools.length === actualTools.length
    && expectation.expectedTools.every((toolName, index) => toolName === actualTools[index]);
  const numericalChecks = (expectation.expectedNumerics ?? []).map((expected) => {
    const result = observed.toolResults.find((tool) => tool.toolName === expected.toolName);
    const actual = getNumericValue(result?.data, expected.path);
    const matched = actual !== undefined && Math.abs(actual - expected.expected) <= expected.tolerance;
    return { ...expected, actual: actual ?? null, matched };
  });
  const numericalCorrect = numericalChecks.every((check) => check.matched);
  const expectedStatusMatched = observed.status === expectation.expectedStatus;

  return {
    expectedStatusMatched,
    expectedToolsMatched,
    numericalChecks,
    numericalCorrect,
    successfulCompletion: expectation.expectedStatus === "completed"
      && expectedStatusMatched
      && expectedToolsMatched
      && numericalCorrect,
  };
}
