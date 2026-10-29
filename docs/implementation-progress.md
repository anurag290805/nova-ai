# Implementation progress

## 2026-10-30 — Direct calculation and workspace refinement

The workspace now opens on an objective composer with concise navigation and expandable execution evidence. Solar, research and reports remain accessible from the workspace. Direct calculation mode makes one model tool-selection call without a separate plan and offers three fixed registered calculation tools; structured mode retains planning and the broader registry. Both use the existing validation, deadlines and budgets. Two bounded live direct-mode tests selected and executed the mechanical-power tool; the second completed after continuation. See the verification report for measured times and limits.

## 2026-10-30 — Recovery and runtime safety

- Recovery found `main` at `d0bab200aa0f5171acffaad41483af4ac62b6702`, with substantial existing tracked CP02 modifications and untracked evaluation artifacts, scripts, and tests. These were preserved; the configured `origin` remained unchanged. Available disk was approximately 3.6 GiB. Process inspection and localhost Ollama access were denied by the execution sandbox, so running evaluations and installed models could not be verified.
- Added a bounded overall execution deadline (`AGENT_DEADLINE_MS`, default 180 seconds) and propagated request cancellation through planning, inference and tool execution. A planning timeout or cancellation terminates the run instead of triggering another model call. Completed tool outputs remain in the returned record when a later step ends.
- Added distinct `timed_out` and `cancelled` results, a per-process single-run API guard, and a browser cancellation control. Cancellation closes the browser request, so its final record cannot be delivered to that browser. Request abort propagation depends on the hosting environment.
- These changes do not prove that Ollama stops inference when its HTTP connection is aborted. The process-local guard is not a cross-process or Ollama-wide lock. No live inference was run in this recovery session; the CP02 live multi-tool gate remains open.

## 2026-10-27 — CP02 recovery and verification

### Implemented

- Recovered the uncommitted Next.js scaffold and verified npm installation.
- Added a responsive AETHRA workspace with Overview, Agent, Workbench, Evidence, Reports, History, and Settings views.
- Added validated engineering calculations, safe arithmetic parsing, and solar tracking scenario analysis.
- Added a ten-tool registry with structured execution results, including explicit-duration operating energy.
- Added Crossref public metadata search and bounded public URL reading.
- Replaced the prior provider path with a localhost-only Ollama tool-use loop, including model continuation, event lifecycle, timeouts, and partial status.
- CP02: added Ollama-generated structured planning with explicit fallback labelling, context-appropriate candidate tool sets, plan metadata, and runtime metrics.
- Added a single retry path for retryable tool failures; retry attempts consume the execution budget and emit a `tool_retried` event.
- Added API request validation at `POST /api/agent/run`.
- Added browser-local run history and print-oriented report view.
- Added tests for formulas, parser security boundary, tool validation, model-directed candidate enforcement, fallback planning, multi-tool execution, and budget handling.
- Added architecture, academic, portfolio, known-issues, and verification documentation.

### Verified

- `npm install` completed.
- Current recovery verification: `npm test` passed with 5 files / 30 tests.
- `npm run typecheck` passed.
- `npm run lint` passed with no warnings after the PostCSS config cleanup.
- Current recovery verification: `npm run build` passed in webpack mode. The default Turbopack production build reproducibly fails while creating a PostCSS worker on this macOS environment, so the script explicitly uses the verified webpack builder.
- Current live browser smoke: `llama3.2:1b` created an `ollama` plan, selected `calculate_mechanical_power` for 50 Nm / 1500 RPM, and returned the real grounded value of 7.8539816 kW.
- Three real benchmarks passed: mechanical 15,165 ms, energy 30,746 ms, and cost comparison 11,055 ms.
- Dimension-aware engineering units and one model correction retry were added for solar arguments.
- Added versioned evaluation corpus at `evaluation/corpus.json` and local runner `npm run evaluate:local`.
- Current live solar run: fallback planning selected `solar_tracking_analysis` and returned fixed 2340, single-axis 2568.384, and dual-axis 2712.06 kWh/year. The model supplied `ratedPowerKw: 2000` for a stated 2 kW value; the deterministic tool preserved it and emitted a physical-consistency warning rather than silently changing it.
- Invalid API input smoke test returned HTTP 400 with a validation message.

### Pending

- Small-model solar prompts that omit required parameters can still return `partial`; NOVA does not invent missing engineering inputs.
- Live multi-tool acceptance remains unpassed. Two current 1B-model attempts planned or executed only `calculate_mechanical_power`; the post-fix fallback plan offered `operating_energy`, but the model stopped after the first result.
- Live CP02 evaluation corpus execution requires a running Ollama-backed Next server and is not automatically run by ordinary unit tests.
- Browser automation and viewport checks are not configured yet.
- Production persistence, authentication, rate limiting, and server-side PDF export remain future work.

### Next action

Use a more reliable local model only after assessing hardware resources, then repeat the one targeted live multi-tool objective and record its actual outcome. Do not mark CP02 accepted until that gate passes.
