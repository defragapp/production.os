import { NextRequest } from "next/server";
import { requireOwner } from "@/lib/owner";
import { ModelError, createCloudflareModel } from "@/lib/sovereign-model";
import type { ChatMessage } from "@/lib/types";
import { buildAgentLeeMessages } from "@/lib/agent-lee";

function badRequest(message: string, status = 400) {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  // Owner-only. Agent Lee is the operator's launch analyst (its system prompt
  // carries internal infra detail and it is not wired to any client surface),
  // so it must never act as a public, un-metered model proxy: this route
  // predates the /api/chat quota + burst + extraction guards, and every
  // signed-in user could otherwise script it to bypass the free-tier daily
  // cap and drain the AI Gateway. `requireOwner` verifies the session against
  // the live token_version (not merely the middleware, which this
  // extension-free path always reaches) and answers a non-owner with the
  // same indistinguishable 404 as every other owner surface.
  const { session, denial } = await requireOwner(request);
  if (denial) return denial;
  const env = session.env;
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

