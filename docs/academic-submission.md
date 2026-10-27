# Academic demonstration guide

## What makes NOVA agentic?

NOVA is not a fixed answer template. The objective classification changes the plan and tool path:

- A solar objective selects the solar scenario model and then a percentage comparison.
- A calculation objective selects the bounded arithmetic tool or an engineering formula.
- A research objective selects public evidence retrieval and preserves the returned references.
- The local Ollama model can choose among the registered tools through `/api/chat` tool-use messages and can make multiple calls within the run budget.

The UI makes this progression visible through plan steps, tool-selected events, tool results, plan checkpoints, warnings, and a terminal status. The app shows operational traces, not fabricated hidden reasoning.

## Professor run-through

1. `npm install`
2. `npm run dev`
3. Open `http://localhost:3000`.
4. Use the solar objective on the Overview page.
5. In the Agent workspace, expand the `solar_tracking_analysis` and `percentage_improvement` results.
6. Point out that the fixed, single-axis, and dual-axis values come from `src/lib/engineering/solar.ts` and are not decorative constants in the UI.
7. Set the execution budget to one by calling the route directly or using the test; the runner returns partial completion instead of claiming the comparison ran.
8. Open Workbench and change assumptions to show the chart and result cards use one shared calculation.
9. Open Reports to inspect the actual objective, method, limitations, and source section.

## Local model distinction

The response is labelled `OLLAMA LOCAL` only after a successful local model response. If Ollama is stopped or the configured model is missing, the response is `failed` and explains how to restore the local dependency. No paid or cloud provider is used.

## Development schema

The main evaluation layers are:

- Unit tests for formulas, parser boundaries, and input validation.
- Agent tests for multi-tool local execution and budget-limited partial status.
- Build, TypeScript, and lint checks for framework health.
- Manual UI verification of objective submission, event inspection, workbench consistency, report view, and responsive layout.

## Questions to evaluate

- Does the selected objective change the plan and tool sequence?
- Can a tool fail without becoming a fabricated success?
- Are assumptions and missing information explicit?
- Is a source reference preserved and distinguishable from a verified fact?
- Does the one-call budget produce a partial result?
- Is a successful local Ollama run clearly distinguished from an unavailable-model failure?
