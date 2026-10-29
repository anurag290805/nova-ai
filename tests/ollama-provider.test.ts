import { afterEach, describe, expect, it, vi } from "vitest";

import { chatWithOllama, getOllamaConfig } from "@/lib/providers/ollama";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Ollama provider configuration", () => {
  it("distinguishes an external cancellation from a model timeout", async () => {
    const controller = new AbortController();
    vi.stubGlobal("fetch", vi.fn((_url: URL | RequestInfo, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    })));
    const pending = chatWithOllama(getOllamaConfig({}), [{ role: "user", content: "hello" }], [], { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: "cancelled" });
  });
  it("keeps Llama as the default baseline and applies bounded Qwen3 options", () => {
    const llama = getOllamaConfig({});
    expect(llama.model).toBe("llama3.2:1b");
    expect(llama.think).toBeUndefined();
    expect(getOllamaConfig({ OLLAMA_MODEL: "qwen3:1.7b" })).toMatchObject({ model: "qwen3:1.7b", think: false, numPredict: 256 });
  });

  it("allows a server-side thinking override and sends it as an Ollama chat option", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ message: { role: "assistant", content: "ok" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const config = getOllamaConfig({ OLLAMA_MODEL: "qwen3:1.7b", OLLAMA_THINK: "true" });

    await chatWithOllama(config, [{ role: "user", content: "hello" }]);

    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as { model: string; think?: boolean; options?: { num_predict?: number } };
    expect(config.think).toBe(true);
    expect(request).toMatchObject({ model: "qwen3:1.7b", think: true, options: { num_predict: 256 } });
  });
});
