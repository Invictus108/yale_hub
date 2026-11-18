import { NextResponse } from "next/server";
import * as z from "zod/v4";
import { currentNetId } from "../../lib/session";
import { sendChatMessage } from "../../../src/core/chat-service";
import { ChatError, createChat } from "../../../src/core/memory/chat-store";

const input = z.object({ message: z.string().trim().min(1).max(10000), chatId: z.string().uuid().optional(), requestId: z.string().uuid() });
export async function POST(request: Request) {
  const netId = await currentNetId();
  if (!netId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  try {
    const body = input.parse(await request.json());
    const id = body.chatId || (await createChat(netId)).id;
    const chat = await sendChatMessage(netId, id, body.message, body.requestId);
    return NextResponse.json({ chat });
  } catch (err) {
    const status = err instanceof ChatError ? err.status : err instanceof z.ZodError || err instanceof SyntaxError ? 400 : 500;
    return NextResponse.json({ error: err instanceof ChatError ? err.message : status === 400 ? "A message (up to 10,000 characters), valid chat ID, and request ID are required." : "Could not save this conversation. Please try again." }, { status });
  }
}
