import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/agent/run/route";

describe("POST /api/agent/run validation boundary", () => {
  it("rejects invalid request bodies before agent execution", async () => {
    const response = await POST(new Request("http://localhost/api/agent/run", {
      method: "POST",
      body: JSON.stringify({ objective: "x", maxToolCalls: 99 }),
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: expect.any(String) });
  });

  it("rejects malformed JSON safely", async () => {
    const response = await POST(new Request("http://localhost/api/agent/run", {
      method: "POST",
      body: "not-json",
      headers: { "content-type": "application/json" },
    }));
    expect(response.status).toBe(500);
  });
});
