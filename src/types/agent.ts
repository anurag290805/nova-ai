import type { EngineeringValueIssue } from "@/lib/engineering/units";

export type AgentMode = "ollama-local" | "local-demonstration";

export type PlanSource = "ollama" | "fallback" | "direct";

export type AgentStatus = "completed" | "partial" | "failed" | "cancelled" | "timed_out";

export type AgentEventType =
  | "task_received"
  | "plan_created"
  | "plan_revised"
  | "tool_selected"
  | "tool_started"
  | "tool_completed"
  | "tool_failed"
  | "tool_retried"
  | "evidence_collected"
  | "calculation_completed"
  | "validation_warning"
  | "report_generated"
  | "task_completed"
  | "task_partially_completed"
  | "task_failed";

export type AgentEvent = {
  id: string;
  type: AgentEventType;
  timestamp: string;
  message: string;
  toolName?: string;
  metadata?: Record<string, string | number | boolean>;
};

export type PlanStep = {
  id: string;
  title: string;
  purpose: string;
  toolName?: string;
  status: "pending" | "active" | "complete" | "skipped";
};

export type AgentPlan = {
  revision: number;
  source: PlanSource;
  objective: string;
  steps: PlanStep[];
  requiredCapabilities: string[];
  missingInformation: string[];
  assumptionsToValidate: string[];
  deliverable: string;
};

export type AgentMetrics = {
  planningDurationMs: number;
  modelTurns: number;
  modelDurationsMs: number[];
  toolCalls: number;
  toolDurationsMs: Array<{ toolName: string; durationMs: number; status: "completed" | "failed" }>;
  validationFailures: number;
  retries: number;
  providerTelemetry: Array<{
    loadDurationNs?: number;
    promptEvalCount?: number;
    evalCount?: number;
    totalDurationNs?: number;
  }>;
};

export type ToolRunResult = {
  toolName: string;
  status: "completed" | "failed";
  summary: string;
  data?: unknown;
  error?: string;
  validationIssues?: EngineeringValueIssue[];
};

export type AgentRuntimeRecord = {
  executionMode: "structured" | "direct";
  model: string | null;
  think: boolean | null;
  planningPromptVersion: string;
  executionPromptVersion: string;
  toolCatalogVersion: string;
};

export type AgentRunResult = {
  runId: string;
  objective: string;
  mode: AgentMode;
  status: AgentStatus;
  plan: AgentPlan;
  planRevisions: AgentPlan[];
  metrics: AgentMetrics;
  events: AgentEvent[];
  toolResults: ToolRunResult[];
  sources: Array<{ title: string; url: string; doi?: string }>;
  runtime: AgentRuntimeRecord;
  finalSummary: string;
  warnings: string[];
  startedAt: string;
  completedAt: string;
};
