# Artificial Intelligence Digital Assignment III — demonstration guide

NOVA by AETHRA is a local engineering assistant that accepts an objective, asks an Ollama model to choose among registered tools, executes a validated tool, and can return the observed result to the model. Its final record contains operational events, tool outputs, warnings and status. This decision–action–observation loop is why it is an agent rather than a fixed answer template. Calculations are performed by deterministic code; the model does not supply the numerical result as evidence.

## Development schema

```text
User objective → Structured plan (or direct first decision)
                         ↓
                 Model selects a tool → Validated tool execution
                                                ↓
                                      Observed tool result
                                                ↓
                                  Model evaluation / continuation
                                                ↓
                              Final output + events + status
```

In quick-calculation mode, the first model decision combines deciding how to proceed and selecting from three calculation tools; there is no separate AI-generated plan. Structured-investigation mode uses the separate validated planning call and broader tools, with explicitly labelled fallback on invalid plans. The model may choose no tool, or request another tool within the budget. Validation and the supervisor reject invalid or unoffered tools and return partial or failed status when the work cannot be completed. Events appear after the response arrives; they are not a live stream. No hidden reasoning is displayed.

## Preparation and demonstration

1. Install Node.js 22+, npm, and Ollama. Have the local `llama3.2:1b` model already installed; no paid service is required.
2. From the repository root run `npm ci`, copy `.env.example` to `.env.local`, and start Ollama locally with cloud features disabled (`OLLAMA_NO_CLOUD=1 ollama serve` if it is not already running).
3. Run `npm run dev` and open `http://localhost:3000`. Open **New task**.
4. Select **Quick calculation** and submit `Calculate mechanical power for 50 Nm at 1500 RPM.` Wait for the bounded run to finish; do not submit repeatedly.
5. Inspect the plan source, timeline, `calculate_mechanical_power` tool result, and final status. The independent reference is 50 × 1500 × 2π / 60 = 7,853.98 W, approximately **7.85 kW mechanical shaft power**. Only claim an actual tool selection and result if they appear in the run record.
6. Explain that the model receives the structured tool result for its next decision. If a timeout or partial result occurs, show it honestly; small local models can fail to call or continue a tool.

On 2026-10-30, the separate planning path timed out before executing a tool. Two subsequent direct-mode tests selected `calculate_mechanical_power` and produced 7.853981633974483 kW; the second completed after the model observed the tool result in 9.29 seconds with the model warm. The first was partial because its one-tool budget prevented continuation. These observations do not establish reliable multi-tool behavior. See [verification-report.md](verification-report.md) for details and remaining checks.

## Screenshots and recording

After a successful run, capture the objective and terminal status, the event timeline showing tool selection and completion, and the expanded tool output. Include the plan source and any warnings. For a short recording, show the objective being submitted, wait for the actual result, then point out the selected tool, its data, the final output and the limitations. Do not edit a failed run into a successful one or present a historical image as a new run.

## Submission link and limits

Repository: https://github.com/anurag290805/nova-ai. The current local changes must be reviewed and explicitly committed and pushed by the owner before that link reflects them. Confirm the professor can access the repository. NOVA is a local demonstration, not a production engineering authority; results should be checked and assumptions disclosed. Live multi-tool completion is not established.
