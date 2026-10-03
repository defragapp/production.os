import { NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { ModelError, createCloudflareModel } from "@/lib/sovereign-model";
import type { ChatMessage } from "@/lib/types";
import { buildAgentLeeMessages } from "@/lib/agent-lee";

function badRequest(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  const env = await getEnv();
  let body: { messages?: ChatMessage[] };

  try {
    body = (await request.json()) as { messages?: ChatMessage[] };
  } catch {
    return badRequest("Invalid JSON body");
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return badRequest("messages array is required");
  }

  const model = createCloudflareModel(env);
  const messages = buildAgentLeeMessages(body.messages);

  try {
    const result = await model.generate({ messages, maxTokens: 512 });
    return Response.json(
      { reply: result.text, usedGateway: result.usedGateway },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof ModelError) {
      return badRequest(err.message, 503);
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[agent-lee] uncaught: ${message}`);
    return badRequest("Agent Lee couldn't answer right now — try again in a moment.", 500);
  }
}

