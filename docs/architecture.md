# NOVA architecture

Runtime safety: each local model request has a configured timeout, and an overall agent deadline bounds planning and execution. The request signal is passed through to Ollama and tools; the API limits concurrent runs within one server process. These are HTTP-level controls, not proof of Ollama inference termination or a distributed lock.

The workspace offers an explicit quick-calculation mode and a structured-investigation mode. Quick mode skips the separate JSON planning call and offers the model three registered arithmetic and mechanical-power tools; it is a fixed candidate set, not a keyword-selected tool or an AI-generated plan. The model selects the tool, and may continue after its output within the same budgets. Structured mode retains the separate validated plan and broader registry. Runtime metadata and plan source identify the path. A direct response without a tool is partial and its unverified numerical answer is not presented as a grounded result.

## System boundary

```text
Browser (AETHRA workspace)
  ├─ task composer / telemetry / workbench / report viewer
  ├─ browser-local run history
  └─ POST /api/agent/run
          │ server boundary
          ▼
Next.js Node route
  ├─ Zod request validation
  └─ agent engine
       ├─ plan creation and bounded lifecycle
       ├─ localhost-only Ollama tool-use adapter
       └─ event + result assembly
              │ validated registry only
              ▼
       read-only tools
       ├─ safe arithmetic parser
       ├─ engineering calculations
       ├─ solar tracking scenario model
       └─ Crossref search / bounded public URL reader
```

## Execution lifecycle

1. The route validates a 3–2,000 character objective and an optional 1–6 tool-call budget.
2. NOVA asks localhost Ollama for a JSON plan. The plan is Zod-validated and labelled `ollama`; if planning fails, a clearly labelled `fallback` plan is used and the warning is retained. A timeout or cancellation ends the run.
3. The execution loop sends the objective, plan, and a context-appropriate candidate-tool set to Ollama. Provider-selected tools are parsed, dimension-normalized, schema-validated, and executed by name only.
4. If Ollama is unavailable, the runner returns a structured `failed` result with a local-model-unavailable message. There is no cloud or deterministic fallback path.
5. Tool execution has a per-tool timeout, structured success/failure result, a hard call budget, at most one runtime retry, and at most one model correction after validation failure. Retries consume the same budget. Tool output and machine-readable validation issues are returned to the model only as data.
6. Events, plan revisions, tool outputs, source references, warnings, and a terminal status are returned to the UI.

The application never exposes hidden chain-of-thought. The timeline contains observable operational events such as tool selection, start, completion, validation warnings, and terminal status.

## Module boundaries

- `src/app`: Next.js route and page entry points.
- `src/components`: client presentation and interaction state.
- `src/lib/agent`: server-side orchestration, budgets, provider adapter, event lifecycle.
- `src/lib/tools`: validated tool registry and external research boundary.
- `src/lib/engineering`: deterministic domain formulas and solar model.
- `src/types`: shared run, plan, event, and result contracts.
- `tests`: domain, validation, registry, budget, and local-run checks.

## Tool contract

Every registry item has a stable name, natural-language description, read-only permission, Zod input schema, JSON-compatible model schema, and typed execution function. `executeTool` rejects unknown names and invalid input before invocation. Tool errors become structured failed results rather than uncaught provider instructions.

## Security boundaries

- `OLLAMA_BASE_URL` is validated against localhost-only HTTP endpoints; cloud routing is rejected.
- Models cannot execute generated code or shell commands; there is no dynamic evaluation.
- The math tool uses a recursive-descent parser with a small operator grammar.
- Retrieved web text is bounded, converted to plain text, and marked as untrusted evidence. It cannot modify tool descriptions or system instructions.
- Research URLs are limited to HTTP(S) and obvious localhost/private link-local hostnames are rejected. DNS rebinding and broader SSRF defenses remain production hardening work.
- The initial tool set has no external mutation, publishing, deletion, payment, or communication capability.

## Persistence choice

The current release stores recent run records in browser `localStorage` to keep the demo zero-infrastructure and honest. No server persistence is claimed. A production phase should add authenticated task/run/event tables, per-user authorization, retention/deletion behavior, encrypted sensitive fields where necessary, and a migration strategy.

## Deliberate trade-offs

- Native `fetch` avoids an additional provider SDK while keeping the adapter replaceable.
- CSS/SVG charting avoids a large client chart dependency for the single comparison visualization.
- The local model keeps inference at ₹0 and makes the model/tool continuation observable without a paid provider.
- The simplified solar model prioritizes transparent assumptions and testability over false precision.
