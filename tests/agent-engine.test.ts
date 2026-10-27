import { afterEach, describe, expect, it, vi } from "vitest";

import { runAgent } from "@/lib/agent/engine";

const originalBaseUrl = process.env.OLLAMA_BASE_URL;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalBaseUrl === undefined) delete process.env.OLLAMA_BASE_URL;
  else process.env.OLLAMA_BASE_URL = originalBaseUrl;
});

function stubOllamaResponses(responses: unknown[]) {
  const requests: RequestInit[] = [];
  let index = 0;
  vi.stubGlobal("fetch", vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
    if (init) requests.push(init);
    const payload = responses[Math.min(index++, responses.length - 1)];
    return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
  }));
  return requests;
}

describe("Ollama agent execution", () => {
  it("selects a tool, executes it with numeric strings, and continues with the real result", async () => {
    const requests = stubOllamaResponses([
      {
        message: {
          role: "assistant",
          content: "I will calculate the rotational power.",
          tool_calls: [{ function: { name: "calculate_mechanical_power", arguments: { torqueNm: "50", rpm: "1500" } } }],
        },
      },
      {
        message: {
          role: "assistant",
          content: "The registered tool calculated approximately 7.85 kW of ideal power.",
          tool_calls: [],
        },
      },
    ]);

    const result = await runAgent("Calculate mechanical power for 50 Nm at 1500 RPM.", { maxToolCalls: 3 });

    expect(result.mode).toBe("ollama-local");
    expect(result.status).toBe("completed");
    expect(result.toolResults).toHaveLength(1);
    expect(result.toolResults[0].toolName).toBe("calculate_mechanical_power");
    expect(result.toolResults[0].status).toBe("completed");
    expect(result.toolResults[0].data).toMatchObject({ usefulPowerKw: expect.closeTo(7.85398, 4) });
    expect(result.finalSummary).toContain("7.85 kW");
    expect(result.events.some((event) => event.type === "tool_selected")).toBe(true);
    expect(result.events.some((event) => event.type === "plan_revised")).toBe(true);
    expect(requests).toHaveLength(2);

    const continuation = JSON.parse(String(requests[1].body)) as { messages: Array<{ role: string; content: string }> };
    expect(continuation.messages.some((message) => message.role === "tool" && message.content.includes("usefulPowerKw"))).toBe(true);
  });

  it("does not make a continuation request after the tool budget is exhausted", async () => {
    const requests = stubOllamaResponses([
      { message: { role: "assistant", content: "I will calculate it.", tool_calls: [{ function: { name: "safe_math", arguments: { expression: "2 + 2" } } }] } },
    ]);

    const result = await runAgent("Calculate 2 + 2.", { maxToolCalls: 1 });

    expect(result.status).toBe("partial");
    expect(result.toolResults[0].data).toMatchObject({ value: 4 });
    expect(requests).toHaveLength(1);
    expect(result.events.some((event) => event.type === "task_partially_completed")).toBe(true);
  });

  it("returns a clear local-model-unavailable failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("connect ECONNREFUSED"); }));

    const result = await runAgent("Calculate 2 + 2.");

    expect(result.mode).toBe("ollama-local");
    expect(result.status).toBe("failed");
    expect(result.finalSummary).toContain("Local Ollama is unavailable");
    expect(result.events.some((event) => event.type === "task_failed")).toBe(true);
  });

  it("does not permit cloud routing", async () => {
    process.env.OLLAMA_BASE_URL = "https://example.invalid";

    const result = await runAgent("Calculate 2 + 2.");

    expect(result.status).toBe("failed");
    expect(result.finalSummary).toContain("Cloud model routing is disabled");
  });

  it("preserves a failed tool result for model recovery instead of fabricating success", async () => {
    const requests = stubOllamaResponses([
      { message: { role: "assistant", content: "The input needs checking.", tool_calls: [{ function: { name: "calculate_mechanical_power", arguments: { torqueNm: "50 N", rpm: "not-a-number" } } }] } },
      { message: { role: "assistant", content: "The tool rejected the invalid numeric arguments, so no result is available.", tool_calls: [] } },
    ]);

    const result = await runAgent("Calculate mechanical power for an invalid input.", { maxToolCalls: 3 });

    expect(result.status).toBe("partial");
    expect(result.toolResults[0].status).toBe("failed");
    expect(result.toolResults[0].error).toContain("torqueNm");
    expect(result.events.some((event) => event.type === "tool_failed")).toBe(true);
    expect(requests).toHaveLength(2);
  });

  it("permits one corrected solar call after machine-readable unit validation feedback", async () => {
    const validArguments = {
      panelAreaM2: "10 m²",
      panelEfficiencyPct: "20%",
      annualIrradianceKwhM2: "1500 kWh/m²",
      performanceRatioPct: "78%",
      ratedPowerKw: "2 kW",
      singleAxisGainPct: "12%",
      dualAxisGainPct: "22%",
      singleAxisPenaltyPct: "2%",
      dualAxisPenaltyPct: "5%",
    };
    const requests = stubOllamaResponses([
      { message: { role: "assistant", content: "I will model the scenarios.", tool_calls: [{ function: { name: "solar_tracking_analysis", arguments: { ...validArguments, dualAxisPenaltyPct: "5% of output" } } }] } },
      { message: { role: "assistant", content: "I corrected the units.", tool_calls: [{ function: { name: "solar_tracking_analysis", arguments: validArguments } }] } },
      { message: { role: "assistant", content: "The scenarios are ready for review.", tool_calls: [] } },
    ]);

    const result = await runAgent("Compare fixed, single-axis, and dual-axis solar tracking.", { maxToolCalls: 4 });

    expect(result.status).toBe("completed");
    expect(result.toolResults.map((tool) => tool.status)).toEqual(["failed", "completed"]);
    expect(result.toolResults[0].validationIssues?.[0].code).toBe("ambiguous_unit");
    expect(result.events.filter((event) => event.type === "tool_retried")).toHaveLength(1);
    expect(result.finalSummary).toContain("compared 3 solar scenarios");
    expect(requests).toHaveLength(3);
  });

  it("stops after one correction attempt when invalid solar arguments persist", async () => {
    const invalidArguments = {
      panelAreaM2: "10 m²",
      panelEfficiencyPct: "20% of output",
      annualIrradianceKwhM2: "1500 kWh/m²",
      performanceRatioPct: "78%",
      ratedPowerKw: "2 kW",
      singleAxisGainPct: "12%",
      dualAxisGainPct: "22%",
      singleAxisPenaltyPct: "2%",
      dualAxisPenaltyPct: "5%",
    };
    const requests = stubOllamaResponses([
      { message: { role: "assistant", content: "I will model the scenarios.", tool_calls: [{ function: { name: "solar_tracking_analysis", arguments: invalidArguments } }] } },
      { message: { role: "assistant", content: "I will try again.", tool_calls: [{ function: { name: "solar_tracking_analysis", arguments: invalidArguments } }] } },
      { message: { role: "assistant", content: "The inputs remain invalid.", tool_calls: [] } },
    ]);

    const result = await runAgent("Compare solar tracking with invalid percentage input.", { maxToolCalls: 4 });

    expect(result.status).toBe("partial");
    expect(result.toolResults).toHaveLength(2);
    expect(result.toolResults.every((tool) => tool.status === "failed")).toBe(true);
    expect(result.events.filter((event) => event.type === "tool_retried")).toHaveLength(1);
    expect(requests).toHaveLength(3);
  });

  it("keeps grounded tool output when Ollama times out during continuation", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(JSON.stringify({ message: { role: "assistant", content: "I will calculate it.", tool_calls: [{ function: { name: "calculate_mechanical_power", arguments: { torqueNm: "50", rpm: "1500" } } }] } }), { status: 200 });
      }
      throw new TypeError("local continuation unavailable");
    }));

    const result = await runAgent("Calculate mechanical power for 50 Nm at 1500 RPM.", { maxToolCalls: 3 });

    expect(result.status).toBe("partial");
    expect(result.finalSummary).toContain("7.85 kW");
    expect(result.finalSummary).toContain("continuation unavailable");
    expect(result.events.some((event) => event.type === "task_partially_completed")).toBe(true);
  });
});
