export type AgentMode = "ollama-local" | "local-demonstration";

export type AgentStatus = "completed" | "partial" | "failed" | "cancelled";

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
  objective: string;
  steps: PlanStep[];
  missingInformation: string[];
  deliverable: string;
};

export type ToolRunResult = {
  toolName: string;
  status: "completed" | "failed";
  summary: string;
  data?: unknown;
  error?: string;
};

export type AgentRunResult = {
  runId: string;
  objective: string;
  mode: AgentMode;
  status: AgentStatus;
  plan: AgentPlan;
  planRevisions: AgentPlan[];
  events: AgentEvent[];
  toolResults: ToolRunResult[];
  sources: Array<{ title: string; url: string; doi?: string }>;
  finalSummary: string;
  warnings: string[];
  startedAt: string;
  completedAt: string;
};
