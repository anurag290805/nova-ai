import { describe, expect, it } from "vitest";

import { getProjectDescriptor } from "@/lib/project-metadata";

describe("getProjectDescriptor", () => {
  it("identifies the supervised agent workspace", () => {
    expect(getProjectDescriptor()).toEqual({
      productName: "NOVA",
      workspaceName: "AETHRA",
      checkpoint: "CP04 — Supervised agent workspace",
      agentRuntimeAvailable: true,
    });
  });
});
