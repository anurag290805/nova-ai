import { z } from "zod";

import { runAgent } from "@/lib/agent/engine";

export const runtime = "nodejs";

const requestSchema = z.object({
  objective: z.string().trim().min(3).max(2_000),
  maxToolCalls: z.number().int().min(1).max(6).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: "Objective must be between 3 and 2,000 characters." }, { status: 400 });
    }
    const result = await runAgent(parsed.data.objective, { maxToolCalls: parsed.data.maxToolCalls });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "The agent request could not be processed safely." }, { status: 500 });
  }
}
