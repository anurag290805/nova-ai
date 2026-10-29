import { readFile, writeFile } from "node:fs/promises";

import { assessEvaluationCase } from "./evaluation-assessment.mjs";

const baseUrl = process.env.NOVA_URL || "http://localhost:3000";
const outputPath = process.env.NOVA_EVAL_OUTPUT;
const corpus = JSON.parse(await readFile(new URL("../evaluation/corpus.json", import.meta.url), "utf8"));
const results = [];

for (const testCase of corpus.cases) {
  const started = performance.now();
  let response;
  let payload;
  let error;
  try {
    response = await fetch(`${baseUrl}/api/agent/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ objective: testCase.objective, maxToolCalls: 6 }),
    });
    payload = await response.json();
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }
  const durationMs = Math.round(performance.now() - started);
  const actualTools = payload?.toolResults?.map((tool) => tool.toolName) ?? [];
  const assessment = payload
    ? assessEvaluationCase(testCase, { status: payload.status, toolResults: payload.toolResults ?? [] })
    : { expectedStatusMatched: false, expectedToolsMatched: false, numericalChecks: [], numericalCorrect: false, successfulCompletion: false };
  const expectedValidationFailureMatched = Boolean(testCase.expectedValidationFailure)
    && payload?.status === "partial"
    && (payload?.metrics?.validationFailures ?? 0) > 0;
  const outcome = !payload
    ? "unexpected_failure"
    : assessment.successfulCompletion
      ? "successful_completion"
      : expectedValidationFailureMatched
        ? "expected_validation_failure"
        : testCase.expectedStatus === "partial" && assessment.expectedStatusMatched
          ? "expected_partial"
          : "unexpected_failure";
  results.push({
    id: testCase.id,
    expectedStatus: testCase.expectedStatus,
    actualStatus: payload?.status ?? "unavailable",
    expectedTools: testCase.expectedTools,
    actualTools,
    runtime: payload?.runtime ?? null,
    toolArguments: payload?.toolResults?.map((tool) => tool.data ?? tool.validationIssues ?? null) ?? [],
    planSource: payload?.plan?.source,
    planRevisions: payload?.planRevisions?.length ?? 0,
    modelCalls: payload?.metrics?.modelTurns ?? null,
    toolCalls: payload?.metrics?.toolCalls ?? actualTools.length,
    validationFailures: payload?.metrics?.validationFailures ?? null,
    durationMs,
    perTurnDurationMs: payload?.metrics?.modelDurationsMs ?? [],
    error: error ?? payload?.warnings?.join(" ") ?? null,
    ...assessment,
    expectedValidationFailureMatched,
    outcome,
  });
  console.log(JSON.stringify(results.at(-1)));
}

const summary = {
  corpusVersion: corpus.version,
  baseUrl,
  caseCount: results.length,
  statusMatches: results.filter((result) => result.expectedStatusMatched).length,
  toolSelectionMatches: results.filter((result) => result.expectedToolsMatched).length,
  numericalCorrectCases: results.filter((result) => result.numericalCorrect).length,
  successfulCompletions: results.filter((result) => result.outcome === "successful_completion").length,
  expectedPartialCompletions: results.filter((result) => result.outcome === "expected_partial").length,
  expectedValidationFailures: results.filter((result) => result.outcome === "expected_validation_failure").length,
  unexpectedFailures: results.filter((result) => result.outcome === "unexpected_failure").length,
  completionRate: results.length ? results.filter((result) => result.actualStatus === "completed").length / results.length : 0,
  totalDurationMs: results.reduce((sum, result) => sum + result.durationMs, 0),
  results,
};
if (outputPath) await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ summary: { ...summary, results: undefined } }));
