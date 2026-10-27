# Verification report

Last updated: 2026-10-27

Local inference environment verified: Ollama 0.32.5 at `127.0.0.1:11434`; model `llama3.2:1b` listed by `/api/tags`.

Commands run from the repository root `/Users/Anurag/Desktop/NOVA-AI`:

| Command | Result | Notes |
| --- | --- | --- |
| `npm install` | PASS | Lockfile and dependency tree are usable. |
| `npm test` | PASS | 3 test files, 18 tests passed. |
| `npm run typecheck` | PASS | Strict TypeScript check passed. |
| `npm run lint` | PASS | ESLint passed with no warnings. |
| `npm run build` | PASS | Next production build passed; `/api/agent/run` is dynamic. |

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
