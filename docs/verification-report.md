# Verification report

## Academic release check — 2026-10-30

### Direct calculation path — subsequent controlled tests

After the direct-path and interface changes, `npm run typecheck`, `npm run lint`, `npm test` (7 files, 40 tests), `npm run build`, and `git diff --check` all passed.

With `llama3.2:1b`, Ollama 0.32.5, cloud disabled, a 2,048-token context and the objective `Calculate mechanical power for 50 Nm at 1500 RPM.`, two API runs were performed sequentially:

| Run | End-to-end | Outcome | Evidence |
| --- | ---: | --- | --- |
| Cold model, one-tool budget | 12.80 s | partial | Model selected `calculate_mechanical_power`; registered tool returned 7.853981633974483 kW. The budget intentionally prevented a continuation decision. |
| Warm model, six-tool budget | 9.29 s | completed | Model selected the same registered tool, received its real output on a second model turn, and returned a grounded 7.85 kW summary. |

The first call took 12.59 s including approximately 5.26 s model loading. The second run's model calls took 2.33 s and 6.94 s. These are two single-tool observations, not a reliability benchmark or evidence of live multi-tool completion. The direct path does not generate a separate structured plan. The live tests preceded the metadata-label and report-copy refinements; inference behavior did not change in those refinements.

The revised workspace was visually inspected at a desktop viewport and at 375 × 812. Selecting an example filled the objective, and the contextual solar workbench opened with its controls and scenario outputs. The two model runs above were API tests; a browser-submitted inference and cancellation were not verified in this check. The temporary viewport override was reset.

- On the current working tree, `npm run typecheck`, `npm run lint`, and `npm test` passed; Vitest reported 7 files and 37 tests. `npm run build` passed with webpack, producing the page and dynamic API route.
- Node 22.23.2 and npm 10.9.8 were present; `npm ls --depth=0` reported the installed dependency tree. A clean `npm ci` installation was not performed, so fresh-install reproducibility remains unverified.
- The production server returned the main page over HTTP. Browser automation timed out, so interactive UI use was not verified in this check.
- Ollama 0.32.5 was started locally with cloud disabled; `llama3.2:1b` and `qwen3:1.7b` were installed. The single `llama3.2:1b` objective `Calculate mechanical power for 50 Nm at 1500 RPM.` returned HTTP 200 with `timed_out` after 127.55 seconds. Planning took 122.4 seconds and hit the 120-second model timeout; the record contained a labelled fallback plan, zero tool calls, zero retries, and no numerical output. This does not demonstrate a successful agent workflow. No full corpus was run.
- The committed tree was checked for common private-key and credential patterns with no matches; `.env.example` is the only tracked environment file. This limited scan does not prove the absence of all secrets.

## Historical verification — 2026-10-27

The following results describe the earlier environment and working tree, not the current release check. Ollama 0.32.5 at `127.0.0.1:11434` and model `llama3.2:1b` were then observed.

Commands run from the repository root `/Users/Anurag/Desktop/NOVA-AI`:

| Command | Result | Notes |
| --- | --- | --- |
| `npm install` | PASS | Lockfile and dependency tree are usable. |
| `npm test` | PASS | 5 test files, 30 tests passed. |
| `npm run typecheck` | PASS | Strict TypeScript check passed. |
| `npm run lint` | PASS | ESLint passed with no warnings. |
| `npm run build` | PASS | Webpack production build passed; `/api/agent/run` is dynamic. The default Turbopack builder failed reproducibly while creating a PostCSS worker, so the package script uses webpack. |

## CP02 recovery verification (current working tree)

- Browser-live mechanical smoke: an `ollama` plan selected `calculate_mechanical_power` for 50 Nm at 1500 RPM, the registered tool returned `7.853981633974483 kW`, and the run completed after one tool call.
- Targeted live multi-tool verification was attempted twice. Both runs had plan-schema validation failures and were explicitly marked `fallback`; the post-fix fallback plan offered both steps, but `llama3.2:1b` selected only `calculate_mechanical_power` and ended. This is **not** a completed live multi-tool acceptance.
- Browser-live explicit solar run was explicitly marked `fallback`, selected `solar_tracking_analysis`, and returned fixed `2340`, single-axis `2568.384`, and dual-axis `2712.06 kWh/year`. It also warned that the model-provided `ratedPowerKw: 2000` is physically inconsistent with the stated 10 m² / 20% array.
- The latest full nine-case corpus was not rerun because the current 1B model had already failed the live multi-tool gate and each CPU-only run takes roughly one to three minutes from browser submission to observed terminal state. Earlier result files remain diagnostic evidence only.

## Covered behavior

- Safe arithmetic grammar rejects unsupported code-like input and division by zero.
- Mechanical power, percentage comparison, and solar scenario values are tested against independent reference arithmetic.
- Tool input schemas reject invalid values before dispatch.
- Dimension-aware unit normalization accepts `1500 rpm`, `10 m²`, `1500 kWh/m²`, `2 kW`, and `20%`; incompatible, ambiguous, unknown, and nonfinite values fail with machine-readable validation issues.
- Ollama-mocked execution selects `calculate_mechanical_power`, executes numeric-string arguments, and continues with the real structured result.
- A one-call budget returns `partial` and does not make a continuation request.
- Retry behavior is bounded to one model correction per tool, consumes the same tool-call budget, and preserves grounded output when continuation fails.
- Real localhost Ollama acceptance passed: `llama3.2:1b` selected `calculate_mechanical_power` for 50 Nm / 1500 RPM and NOVA returned the grounded 7.85 kW result.
- Real localhost benchmark passed for three engineering objectives:

  | Objective | Time | Status | Tool |
  | --- | ---: | --- | --- |
  | 50 Nm at 1500 RPM | 15,165 ms | completed | `calculate_mechanical_power` |
  | 5 kW, 6 h/day, 365 days, 20% capacity | 30,746 ms | completed | `energy_production` |
  | Fixed mechanism 1200 vs dual-axis 1800 | 11,055 ms | completed | `cost_comparison` |

- Three independent live solar runs were executed in the first reliability batch:

  | Run | Time | Status | Tool / validation outcome |
  | --- | ---: | --- | --- |
  | Underspecified 10 m² objective | 84,525 ms | partial | Missing `panelEfficiencyPct` and `ratedPowerKw`; one correction permitted |
  | Explicit 10 m² assumptions | 52,470 ms | completed | `solar_tracking_analysis` completed; all three scenarios returned |
  | Explicit 20 m² assumptions | 73,515 ms | failed | Missing `singleAxisGainPct`; continuation reached the 60-second timeout used by that run |

- First-batch solar completion rate: 1/3 (33.3%). This is a measured result, not a reliability guarantee.
- After increasing the bounded local timeout and reducing the solar plan to its single scenario tool, a final independent explicit run completed in 86,414 ms. It returned fixed `2340 kWh/year`, single-axis `2568.384 kWh/year`, and dual-axis `2712.06 kWh/year`.
- A follow-up explicit run before the final plan reduction completed the solar tool but timed out during continuation; the updated engine now returns that case as `partial` with grounded tool output rather than discarding it.
- Invalid API input returned HTTP 400.

## Not verified in this environment

- Browser end-to-end automation, Lighthouse, screen-reader audit, and 375/768/1440 pixel checks.
- Durable database persistence or multi-user authorization.
- Server-side PDF pagination.
