# Portfolio case study — NOVA by AETHRA

## Problem

Engineering questions often require a sequence of evidence gathering, calculations, assumptions, and comparison rather than a single conversational answer. A demo that only streams prose hides whether any work occurred.

## Product motivation

NOVA was designed as a supervised engineering workspace where the user can see what the system planned, which bounded tool it selected, what the tool returned, and where uncertainty remains. AETHRA provides the product surface for that workflow.

## Architecture

The first release is a TypeScript-first Next.js application. A server route validates objectives and hosts the agent engine. The engine uses a localhost-only Ollama tool-calling adapter. A small Zod-validated registry contains safe math, engineering formulas, a solar scenario model, and public research retrieval.

## Engineering challenges

- Designing a safe arithmetic capability without `eval`.
- Keeping solar cards, chart data, and agent output on one deterministic model.
- Handling provider absence honestly while keeping a useful technical demonstration.
- Bounding model turns and tool calls, then representing partial execution as partial.
- Keeping retrieved source content separate from privileged instructions.

## Verification

The repository has unit coverage for formulas, parser errors, solar scenarios, tool validation, multi-tool local execution, and execution budgets. TypeScript, ESLint, Vitest, and Next production build checks are part of the release gate. See `docs/verification-report.md` for the actual latest run.

## Results

The current implementation provides a working local engineering investigation, inspectable events, scenario controls, source ledger, report viewer, and optional live-provider boundary. No user adoption, accuracy, performance, or benchmark claim is made because those measurements have not been collected.

## Limitations and next steps

Live provider validation needs a usable API credential and quota. Production persistence needs authentication, database migrations, retention controls, and authorization. Research needs stronger SSRF protections and source-content extraction. The solar model needs location/weather inputs, uncertainty propagation, and independent validation against a professional PV simulator. Browser print export can be replaced with a tested server-side PDF pipeline when that requirement is real.
