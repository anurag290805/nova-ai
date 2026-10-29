import { z } from "zod";

import { getModelTools } from "@/lib/tools/registry";

const DEFAULT_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_MODEL = "llama3.2:1b";
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_QWEN_NUM_PREDICT = 256;

const ollamaResponseSchema = z.object({
  load_duration: z.number().optional(),
  prompt_eval_count: z.number().optional(),
  eval_count: z.number().optional(),
  total_duration: z.number().optional(),
  message: z.object({
    role: z.string().default("assistant"),
    content: z.string().default(""),
    tool_calls: z
      .array(
        z.object({
          function: z.object({
            name: z.string(),
            arguments: z.unknown().default({}),
          }),
        }),
      )
      .default([]),
  }),
});

export type OllamaToolCall = {
  function: {
    name: string;
    arguments: unknown;
  };
};

export type OllamaMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: OllamaToolCall[];
};

export type OllamaChatResult = {
  message: OllamaMessage;
  telemetry: {
    loadDurationNs?: number;
    promptEvalCount?: number;
    evalCount?: number;
    totalDurationNs?: number;
  };
};

export type OllamaConfig = {
  baseUrl: string;
  model: string;
  timeoutMs: number;
  think?: boolean;
  numPredict?: number;
};

export class OllamaProviderError extends Error {
  constructor(
    message: string,
    public readonly code: "configuration" | "unavailable" | "request" | "timeout" | "cancelled",
  ) {
    super(message);
    this.name = "OllamaProviderError";
  }
}

export function getOllamaConfig(env: NodeJS.ProcessEnv = process.env): OllamaConfig {
  const baseUrl = env.OLLAMA_BASE_URL?.trim() || DEFAULT_BASE_URL;
  if (!isLocalOllamaUrl(baseUrl)) {
    throw new OllamaProviderError(
      "Cloud model routing is disabled. OLLAMA_BASE_URL must use a localhost Ollama endpoint.",
      "configuration",
    );
  }
  const model = env.OLLAMA_MODEL?.trim() || DEFAULT_MODEL;
  const think = getThinkingPreference(model, env.OLLAMA_THINK);
  const numPredict = getGenerationLimit(model, env.OLLAMA_NUM_PREDICT);
  const configuredTimeout = env.OLLAMA_TIMEOUT_MS?.trim();
  const timeoutMs = configuredTimeout ? Number(configuredTimeout) : DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 5_000 || timeoutMs > 120_000) {
    throw new OllamaProviderError("OLLAMA_TIMEOUT_MS must be an integer between 5000 and 120000.", "configuration");
  }
  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    model,
    timeoutMs,
    ...(think === undefined ? {} : { think }),
    ...(numPredict === undefined ? {} : { numPredict }),
  };
}

export async function chatWithOllama(
  config: OllamaConfig,
  messages: OllamaMessage[],
  toolNames?: readonly string[],
  options: { format?: "json"; signal?: AbortSignal } = {},
): Promise<OllamaChatResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const signal = options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal;
  try {
    signal.throwIfAborted();
    const modelTools = toolNames?.length ? getModelTools(toolNames).map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    })) : undefined;
    const response = await fetch(`${config.baseUrl}/api/chat`, {
      method: "POST",
      signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        messages,
        ...(modelTools ? { tools: modelTools } : {}),
        stream: false,
        ...(options.format ? { format: options.format } : {}),
        ...(config.think === undefined ? {} : { think: config.think }),
        options: { temperature: 0, ...(config.numPredict === undefined ? {} : { num_predict: config.numPredict }) },
      }),
    });

    const payload = (await response.json()) as unknown;
    if (!response.ok) {
      const detail = readProviderError(payload);
      const message = response.status === 404
        ? `Local Ollama model '${config.model}' was not found. Run 'ollama pull ${config.model}'.`
        : `Local Ollama returned HTTP ${response.status}: ${detail}`;
      throw new OllamaProviderError(message, response.status === 404 ? "unavailable" : "request");
    }
    const parsed = ollamaResponseSchema.safeParse(payload);
    if (!parsed.success) throw new OllamaProviderError("Ollama returned an invalid chat response.", "request");
    return {
      message: {
        role: "assistant",
        content: parsed.data.message.content,
        tool_calls: parsed.data.message.tool_calls,
      },
      telemetry: {
        loadDurationNs: parsed.data.load_duration,
        promptEvalCount: parsed.data.prompt_eval_count,
        evalCount: parsed.data.eval_count,
        totalDurationNs: parsed.data.total_duration,
      },
    };
  } catch (error) {
    if (error instanceof OllamaProviderError) throw error;
    if (options.signal?.aborted) throw new OllamaProviderError("Agent execution was cancelled or reached its deadline.", "cancelled");
    if (controller.signal.aborted) throw new OllamaProviderError(`Local Ollama timed out after ${config.timeoutMs} ms.`, "timeout");
    throw new OllamaProviderError(
      `Local Ollama is unavailable at ${config.baseUrl}. Start Ollama and verify that '${config.model}' is installed.`,
      "unavailable",
    );
  } finally {
    clearTimeout(timeout);
  }
}

function getThinkingPreference(model: string, configured: string | undefined) {
  if (configured !== undefined && configured.trim() !== "") {
    if (configured.trim() === "true") return true;
    if (configured.trim() === "false") return false;
    throw new OllamaProviderError("OLLAMA_THINK must be either true or false when supplied.", "configuration");
  }
  return model.toLowerCase().startsWith("qwen3") ? false : undefined;
}

function getGenerationLimit(model: string, configured: string | undefined) {
  if (configured !== undefined && configured.trim() !== "") {
    const parsed = Number(configured);
    if (!Number.isInteger(parsed) || parsed < 16 || parsed > 4_096) {
      throw new OllamaProviderError("OLLAMA_NUM_PREDICT must be an integer between 16 and 4096 when supplied.", "configuration");
    }
    return parsed;
  }
  return model.toLowerCase().startsWith("qwen3") ? DEFAULT_QWEN_NUM_PREDICT : undefined;
}

function isLocalOllamaUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" && ["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
}

function readProviderError(payload: unknown) {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string") return error.slice(0, 240);
    if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") return error.message.slice(0, 240);
  }
  return "The local provider did not provide a detailed error.";
}
