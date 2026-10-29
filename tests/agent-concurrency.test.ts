import { describe, expect, it, vi } from "vitest";

const { runAgent } = vi.hoisted(() => ({ runAgent: vi.fn() }));
vi.mock("@/lib/agent/engine", () => ({ runAgent }));
import { POST } from "@/app/api/agent/run/route";

describe("agent request concurrency", () => {
  it("rejects another run while one is active and releases the slot on completion", async () => {
    let finish!: (value: object) => void;
    runAgent.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    runAgent.mockResolvedValue({ status: "completed" });
    const request = () => new Request("http://localhost/api/agent/run", { method: "POST", body: JSON.stringify({ objective: "Calculate 2 + 2" }) });
    const first = POST(request());
    await vi.waitFor(() => expect(runAgent).toHaveBeenCalledTimes(1));
    expect((await POST(request())).status).toBe(429);
    finish({ status: "completed" });
    expect((await first).status).toBe(200);
    expect((await POST(request())).status).toBe(200);
  });
});
