import { afterEach, describe, expect, it, vi } from "vitest";

import { runAgent } from "@/lib/agent/engine";

const originalBaseUrl = process.env.OLLAMA_BASE_URL;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalBaseUrl === undefined) delete process.env.OLLAMA_BASE_URL;
  else process.env.OLLAMA_BASE_URL = originalBaseUrl;
});

function stubOllamaResponses(responses: unknown[], planOverride?: object) {
  const requests: RequestInit[] = [];
  let index = 0;
  const plan = {
    message: {
      role: "assistant",
      content: JSON.stringify(planOverride ?? {
        objective: "test objective",
        steps: [{ title: "Inspect objective", purpose: "Select the appropriate registered tool." }],
        requiredCapabilities: ["math mechanical power energy cost solar research comparison"],
        missingInformation: [],
        assumptionsToValidate: [],
        deliverable: "A grounded test result",
      }),
      tool_calls: [],
    },
  };
  vi.stubGlobal("fetch", vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
    if (init) requests.push(init);
    const responseIndex = index++;
    const payload = responseIndex === 0 ? plan : responses[Math.min(responseIndex - 1, responses.length - 1)];
    return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
  }));
  return requests;
}

describe("Ollama agent execution", () => {
  it("direct mode lets the model select a real tool first and observes the result on continuation", async () => {
    const requests: RequestInit[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: URL | RequestInfo, init?: RequestInit) => {
      if (init) requests.push(init);
      const message = requests.length === 1
        ? { role: "assistant", content: "", tool_calls: [{ function: { name: "calculate_mechanical_power", arguments: { torqueNm: 50, rpm: 1500 } } }] }
        : { role: "assistant", content: "The tool returned the result.", tool_calls: [] };
      return new Response(JSON.stringify({ message }), { status: 200 });
    }));
    const result = await runAgent("Calculate mechanical power for 50 Nm at 1500 RPM.", { executionMode: "direct" });
    expect(result.runtime.executionMode).toBe("direct");
    expect(result.plan.source).toBe("direct");
    expect(result.status).toBe("completed");
    expect(result.finalSummary).toContain("7.85 kW");
    expect(result.toolResults[0].data).toMatchObject({ usefulPowerKw: expect.closeTo(7.85398, 4) });
    expect(requests).toHaveLength(2);
    const first = JSON.parse(String(requests[0].body));
    expect(first.tools.length).toBeGreaterThan(1);
    expect(first.options.num_predict).toBe(128);
    const second = JSON.parse(String(requests[1].body));
    expect(second.messages.some((m: { role: string; content: string }) => m.role === "tool" && m.content.includes("usefulPowerKw"))).toBe(true);
  });

  it("does not claim a grounded direct result when the model returns no tool", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: { role: "assistant", content: "About 7.85 kW", tool_calls: [] } }))));
    const result = await runAgent("Calculate power.", { executionMode: "direct" });
    expect(result.status).toBe("partial");
    expect(result.finalSummary).not.toContain("7.85");
    expect(result.toolResults).toHaveLength(0);
  });

  it("keeps an invalid direct tool call as a partial result", async () => {
    let turn = 0;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: ++turn === 1
      ? { role: "assistant", content: "", tool_calls: [{ function: { name: "calculate_mechanical_power", arguments: { torqueNm: "bad", rpm: 1500 } } }] }
      : { role: "assistant", content: "Could not calculate.", tool_calls: [] } }))));
    const result = await runAgent("Calculate power.", { executionMode: "direct" });
    expect(result.status).toBe("partial");
    expect(result.toolResults[0].status).toBe("failed");
    expect(result.finalSummary).not.toContain("7.85");
  });
  it("ends a hanging planning call at the overall deadline", async () => {
    vi.useFakeTimers();
    process.env.AGENT_DEADLINE_MS = "5000";
    try {
      const fetchMock = vi.fn((_url: URL | RequestInfo, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      }));
      vi.stubGlobal("fetch", fetchMock);
      const pending = runAgent("Calculate 2 + 2.");
      await vi.advanceTimersByTimeAsync(5000);
      expect((await pending).status).toBe("timed_out");
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      delete process.env.AGENT_DEADLINE_MS;
      vi.useRealTimers();
    }
  });
  it("stops after cancellation during planning without starting another model call", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn((_url: URL | RequestInfo, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    vi.stubGlobal("fetch", fetchMock);
    const pending = runAgent("Calculate 2 + 2.", { signal: controller.signal });
    controller.abort();
    const result = await pending;
    expect(result.status).toBe("cancelled");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
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
    expect(result.plan.source).toBe("ollama");
    expect(result.metrics.planningDurationMs).toBeGreaterThanOrEqual(0);
    expect(result.metrics.modelTurns).toBe(3);
    expect(result.toolResults).toHaveLength(1);
    expect(result.toolResults[0].toolName).toBe("calculate_mechanical_power");
    expect(result.toolResults[0].status).toBe("completed");
    expect(result.toolResults[0].data).toMatchObject({ usefulPowerKw: expect.closeTo(7.85398, 4) });
    expect(result.finalSummary).toContain("7.85 kW");
    expect(result.events.some((event) => event.type === "tool_selected")).toBe(true);
    expect(result.events.some((event) => event.type === "plan_revised")).toBe(true);
    expect(requests).toHaveLength(3);

    const continuation = JSON.parse(String(requests[2].body)) as { messages: Array<{ role: string; content: string }> };
    expect(continuation.messages.some((message) => message.role === "tool" && message.content.includes("usefulPowerKw"))).toBe(true);
  });

  it("does not make a continuation request after the tool budget is exhausted", async () => {
    const requests = stubOllamaResponses([
      { message: { role: "assistant", content: "I will calculate it.", tool_calls: [{ function: { name: "safe_math", arguments: { expression: "2 + 2" } } }] } },
    ]);

    const result = await runAgent("Calculate 2 + 2.", { maxToolCalls: 1 });

    expect(result.status).toBe("partial");
    expect(result.toolResults[0].data).toMatchObject({ value: 4 });
    expect(requests).toHaveLength(2);
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
    expect(requests).toHaveLength(3);
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
    expect(requests).toHaveLength(4);
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
    expect(requests).toHaveLength(4);
  });

  it("keeps grounded tool output when Ollama times out during continuation", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(JSON.stringify({ message: { role: "assistant", content: JSON.stringify({ objective: "test", steps: [{ title: "Calculate", purpose: "Use the rotational power tool." }], requiredCapabilities: ["mechanical power"], missingInformation: [], assumptionsToValidate: [], deliverable: "Grounded calculation" }), tool_calls: [] } }), { status: 200 });
      }
      if (calls === 2) {
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

  it("allows the model to select multiple registered tools in one turn", async () => {
    const requests = stubOllamaResponses([
      {
        message: {
          role: "assistant",
          content: "I will perform both independent checks.",
          tool_calls: [
            { function: { name: "safe_math", arguments: { expression: "2 + 2" } } },
            { function: { name: "cost_comparison", arguments: { optionA: 1200, optionB: 1800, optionAName: "fixed", optionBName: "tracker" } } },
          ],
        },
      },
      { message: { role: "assistant", content: "Both registered tools completed.", tool_calls: [] } },
    ]);

    const result = await runAgent("Calculate 2 + 2 and compare fixed cost 1200 with tracker cost 1800.", { maxToolCalls: 4 });

    expect(result.status).toBe("completed");
    expect(result.toolResults.map((tool) => tool.toolName)).toEqual(["safe_math", "cost_comparison"]);
    expect(result.metrics.toolCalls).toBe(2);
    expect(requests).toHaveLength(3);
  });

  it("continues from rotational power into an operating-energy calculation", async () => {
    const requests = stubOllamaResponses([
      {
        message: {
          role: "assistant",
          content: "I will calculate shaft power first.",
          tool_calls: [{ function: { name: "calculate_mechanical_power", arguments: { torqueNm: 50, rpm: 1500 } } }],
        },
      },
      {
        message: {
          role: "assistant",
          content: "I will now calculate energy at that stated power.",
          tool_calls: [{ function: { name: "operating_energy", arguments: { powerKw: 7.853981633974483, hoursPerDay: 6, days: 30 } } }],
        },
      },
      { message: { role: "assistant", content: "The power and operating-energy calculations are complete.", tool_calls: [] } },
    ]);

    const result = await runAgent("Calculate motor power for 50 Nm at 1500 RPM, then energy for 6 hours per day over 30 days.", { maxToolCalls: 3 });

    expect(result.status).toBe("completed");
    expect(result.toolResults.map((tool) => tool.toolName)).toEqual(["calculate_mechanical_power", "operating_energy"]);
    expect(result.toolResults[1].data).toMatchObject({ operatingHours: 180, energyKwh: expect.closeTo(1_413.7167, 4) });
    expect(result.finalSummary).toContain("7.85 kW useful rotational power");
    expect(result.finalSummary).toContain("1,413.72 kWh");
    expect(JSON.stringify(requests[2].body)).toContain("usefulPowerKw");
  });

  it("does not report completion when the model stops before a pending planned tool step", async () => {
    const requests = stubOllamaResponses([
      {
        message: {
          role: "assistant",
          content: "I will calculate shaft power first.",
          tool_calls: [{ function: { name: "calculate_mechanical_power", arguments: { torqueNm: 50, rpm: 1500 } } }],
        },
      },
      {
        message: {
          role: "assistant",
          content: "The energy is 47.1 kWh.",
          tool_calls: [],
        },
      },
    ], {
      objective: "Calculate shaft power then operating energy.",
      steps: [
        { title: "Calculate shaft power", toolName: "calculate_mechanical_power", purpose: "Use torque and RPM." },
        { title: "Calculate operating energy", toolName: "operating_energy", purpose: "Use the registered power output and duration." },
      ],
      requiredCapabilities: ["calculate_mechanical_power", "operating_energy"],
      missingInformation: [],
      assumptionsToValidate: [],
      deliverable: "Grounded power and energy result",
    });

    const result = await runAgent("Calculate shaft power for 50 Nm at 1500 RPM, then energy for 6 hours.", { maxToolCalls: 3 });

    expect(result.status).toBe("partial");
    expect(result.toolResults.map((tool) => tool.toolName)).toEqual(["calculate_mechanical_power"]);
    expect(result.plan.steps.map((step) => step.status)).toEqual(["complete", "active"]);
    expect(result.events.some((event) => event.type === "task_partially_completed" && event.message.includes("pending tool step"))).toBe(true);
    expect(requests).toHaveLength(3);
  });

  it("labels an invalid planning response as fallback instead of claiming AI planning", async () => {
    const responses: RequestInit[] = [];
    let call = 0;
    vi.stubGlobal("fetch", vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
      if (init) responses.push(init);
      call += 1;
      if (call === 1) return new Response(JSON.stringify({ message: { role: "assistant", content: "not json", tool_calls: [] } }), { status: 200 });
      return new Response(JSON.stringify({ message: { role: "assistant", content: "Ollama could not plan this request.", tool_calls: [] } }), { status: 200 });
    }));

    const result = await runAgent("Help me decide which engineering option is better.");

    expect(result.plan.source).toBe("fallback");
    expect(result.warnings.some((warning) => warning.includes("fallback plan"))).toBe(true);
    expect(result.metrics.modelTurns).toBe(2);
    expect(responses).toHaveLength(2);
  });

  it("rejects a registered tool that was not offered by the model-derived candidate set", async () => {
    const requests = stubOllamaResponses([
      { message: { role: "assistant", content: "I will use arithmetic.", tool_calls: [{ function: { name: "safe_math", arguments: { expression: "2 + 2" } } }] } },
      { message: { role: "assistant", content: "The permitted operating-energy tool is required instead.", tool_calls: [] } },
    ], {
      objective: "energy test",
      steps: [{ title: "Calculate operating energy", toolName: "operating_energy", purpose: "Use stated power and operating duration." }],
      requiredCapabilities: ["operating energy"],
      missingInformation: [],
      assumptionsToValidate: [],
      deliverable: "Grounded operating energy",
    });

    const result = await runAgent("Calculate operating energy for 2 kW over 6 hours.");

    expect(result.status).toBe("partial");
    expect(result.toolResults[0]).toMatchObject({ toolName: "safe_math", status: "failed", error: expect.stringContaining("not offered") });
    const modelRequest = JSON.parse(String(requests[1].body)) as { tools: Array<{ function: { name: string } }> };
    expect(modelRequest.tools.map((tool) => tool.function.name)).not.toContain("safe_math");
  });

  it("keeps both rotational-power and operating-energy tools available in an explicitly labelled fallback plan", async () => {
    const requests: RequestInit[] = [];
    let call = 0;
    vi.stubGlobal("fetch", vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
      if (init) requests.push(init);
      call += 1;
      const responses = [
        { message: { role: "assistant", content: "not valid json", tool_calls: [] } },
        { message: { role: "assistant", content: "Calculate the shaft power.", tool_calls: [{ function: { name: "calculate_mechanical_power", arguments: { torqueNm: 50, rpm: 1500 } } }] } },
        { message: { role: "assistant", content: "Calculate the stated-power operating energy.", tool_calls: [{ function: { name: "operating_energy", arguments: { powerKw: 7.853981633974483, hoursPerDay: 6, days: 30 } } }] } },
        { message: { role: "assistant", content: "The two registered outputs are complete.", tool_calls: [] } },
      ];
      return new Response(JSON.stringify(responses[call - 1]), { status: 200, headers: { "content-type": "application/json" } });
    }));

    const result = await runAgent("Calculate mechanical power for 50 Nm at 1500 RPM, then energy for 6 hours per day over 30 days.", { maxToolCalls: 3 });

    expect(result.plan.source).toBe("fallback");
    expect(result.status).toBe("completed");
    expect(result.toolResults.map((tool) => tool.toolName)).toEqual(["calculate_mechanical_power", "operating_energy"]);
    const continuation = JSON.parse(String(requests[2].body)) as { tools: Array<{ function: { name: string } }> };
    expect(continuation.tools.map((tool) => tool.function.name)).toContain("operating_energy");
  });
});
