# CP02 local evaluation

## Reproducible command

Start the application with local Ollama configured, then run:

```bash
npm run evaluate:local
NOVA_EVAL_OUTPUT=./evaluation/results.json npm run evaluate:local
```

The runner reads the versioned `evaluation/corpus.json` corpus and records one JSON line per case plus an optional JSON result file. It never claims a case passed without receiving an actual API response.

Each result records:

- Test identifier and expected behavior
- Actual status and selected tools
- Tool outputs or validation issues
- Plan source and revision count
- Model/tool call counts
- Validation failures and retries
- Total and per-turn durations
- Error/warning classification
- Independent status, exact tool-selection, and numerical-tolerance assessments
- Outcome classification: successful completion, expected partial, expected validation failure, or unexpected failure

Unit and provider-mocked tests do not require Ollama. The evaluation runner is intentionally opt-in because CPU inference can take several minutes and is an external local dependency.

## Corpus categories

The initial CP02 corpus includes mechanical, energy, cost, explicit solar, underspecified solar, invalid engineering, multi-tool, research, and ambiguous objectives. Expected statuses are conservative: incomplete inputs are expected to remain partial rather than receive invented values.

## Interpretation

Status matches are not equivalent to engineering correctness. The runner now records exact tool-order matches and each declared numerical assertion with its actual value and tolerance. A `successful_completion` requires all three: expected completed status, expected tool sequence, and numerical correctness. Expected partial and validation-failure cases are counted separately. Live completion rate must be reported from the generated results file for the exact machine/model run.

The committed `results-cp02-*.json` files are retained as interrupted or diagnostic evidence; they are not a final benchmark. Do not aggregate runs from different source revisions or model states.

## Security cases

Research content is untrusted evidence. It must not change the plan system prompt, add tools, or grant network permissions. The research tools remain read-only and bounded by their existing URL/content controls.
