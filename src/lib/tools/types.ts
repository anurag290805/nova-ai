import type { z } from "zod";

import type { EngineeringUnitSpec, EngineeringValueIssue } from "@/lib/engineering/units";

export type ToolPermission = "read-only";

export type ToolContext = {
  signal?: AbortSignal;
};

export type ToolDefinition<TSchema extends z.ZodType = z.ZodType> = {
  name: string;
  description: string;
  permission: ToolPermission;
  inputSchema: TSchema;
  modelInput: Record<string, unknown>;
  numericFields?: Readonly<Record<string, EngineeringUnitSpec>>;
  execute: (input: unknown, context: ToolContext) => Promise<unknown>;
};

export type ToolExecution = {
  toolName: string;
  status: "completed" | "failed";
  summary: string;
  data?: unknown;
  error?: string;
  validationIssues?: EngineeringValueIssue[];
};
