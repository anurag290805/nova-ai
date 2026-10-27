import type { ProjectDescriptor } from "@/types/project";

export function getProjectDescriptor(): ProjectDescriptor {
  return {
    productName: "NOVA",
    workspaceName: "AETHRA",
    checkpoint: "CP04 — Supervised agent workspace",
    agentRuntimeAvailable: true,
  };
}
