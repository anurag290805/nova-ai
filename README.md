# NOVA by AETHRA

NOVA is a supervised autonomous engineering research workspace. It turns a technical objective into an explicit plan, selects from a bounded registry of validated read-only tools, observes structured outputs, and records an operational execution trail.

The flagship local demonstration is a solar-tracking investigation: fixed, single-axis, and dual-axis scenarios are calculated from adjustable assumptions and shown with an aligned comparison chart. NOVA labels the output as an estimate rather than a measurement.

## Current release

This repository contains a functional CP04 vertical slice:

- Premium dark-first AETHRA workspace with responsive navigation.
- Agent workspace with objective input, plan, event timeline, tool results, warnings, and terminal status.
- Bounded agent runner with a six-tool-call budget, four model turns, input validation, timeouts, and safe failure states.
- Server-side Ollama adapter using the local `/api/chat` tool-calling interface.
- Ollama is the only live provider; cloud endpoints are rejected and there is no automatic fallback when Ollama is unavailable.
- Safe arithmetic parser with no `eval`, plus mechanical power, energy, percentage, cost, and solar scenario calculations.
- Dimension-aware engineering-unit normalization accepts values such as `1500 rpm`, `10 m²`, `1500 kWh/m²`, `2 kW`, and `20%`, while rejecting incompatible units.
- Public Crossref metadata search and bounded source opening with source URLs retained.
- Engineering workbench with actual controls, calculations, assumptions, warnings, and an accessible SVG/CSS chart.
- Report view backed by the actual run record, with browser print / Save as PDF support.
- Browser-local run history for demonstration continuity. No production database is implied.

## Technology

- Next.js App Router 16
- React 19 and TypeScript strict mode
- Tailwind CSS v4 via PostCSS
- Zod v4 for request and tool validation
- Vitest for unit and integration-level domain checks
- Native `fetch` for the localhost-only Ollama and Crossref adapters

## Setup

Prerequisites: Node.js 22+ and npm 10+.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

### Local live model

Configure the installed Ollama model in `.env.local`:

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2:1b
OLLAMA_TIMEOUT_MS=45000
```

The API route talks only to localhost. A run is labelled `OLLAMA LOCAL` only after a successful local provider response. If Ollama is stopped or the model is missing, NOVA returns a structured local-model-unavailable failure; it does not silently route to a cloud provider or deterministic answer.

## Commands

```bash
npm run dev       # development server
npm run lint      # ESLint
npm run typecheck # strict TypeScript check
npm test          # Vitest suite
npm run build     # production build
npm run start     # serve production build
```

## Demonstration path

1. Ensure Ollama is running with `llama3.2:1b` installed.
2. Open **New task** and submit: `Calculate mechanical power for 50 Nm at 1500 RPM.`
3. Inspect the Ollama-selected tool, numeric-string normalization, structured tool result, continuation event, and grounded 7.85 kW output.
4. Open **Workbench** and change solar gain or penalty assumptions. Recalculate and confirm the chart changes with the cards.
5. Open **Reports** and use **Print / save PDF** for a report artifact from the actual run.
6. Open **Settings** to see the provider, tool, and persistence boundaries.

## Agent workflow

`POST /api/agent/run` validates an objective and invokes `runAgent` on the server. The runner creates a plan, sends the objective and registered JSON-schema-described tools to local Ollama, executes model-selected tools through the validated registry, and sends structured tool results back to Ollama for subsequent decisions. Numeric strings are converted only for explicitly declared numeric fields; invalid values remain rejected.

Tools are read-only in this release. No arbitrary JavaScript, shell commands, external mutations, publishing, or paid operation can be requested by a model.

## Architecture and documentation

- [`docs/architecture.md`](docs/architecture.md) — component boundaries, lifecycle, data flow, and security boundaries.
- [`docs/academic-submission.md`](docs/academic-submission.md) — how to demonstrate that NOVA is agentic rather than a static chatbot.
- [`docs/portfolio-case-study.md`](docs/portfolio-case-study.md) — honest portfolio narrative and limitations.
- [`docs/implementation-progress.md`](docs/implementation-progress.md) — resumable milestone notes.
- [`docs/known-issues.md`](docs/known-issues.md) — current gaps and external dependencies.
- [`docs/verification-report.md`](docs/verification-report.md) — commands actually run and outcomes.

## Important limitations

- Ollama requires the local service and configured model to be running. When unavailable, the UI exposes the failure and does not fabricate an agent result.
- Browser-local history is a development/demo persistence mode. A database, authentication, retention policy, and multi-user access controls are still required for production.
- Crossref returns public scholarly metadata; source claims require human review. Network availability and source accessibility can vary.
- The solar model is a transparent first-order estimate. It does not replace location-specific PV simulation, weather data, structural engineering, tracker controls analysis, or laboratory validation.
- The current report export uses the browser print pipeline rather than a server-side PDF renderer.

## Repository safety

The Git history and `origin` remote are preserved. `.env.local`, secrets, build output, and logs are ignored. No deployment or push is performed by local development commands.
