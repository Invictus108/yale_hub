import { NextResponse } from "next/server";
import { currentNetId } from "../../../../lib/session";
import { ChatError, readChat } from "../../../../../src/core/memory/chat-store";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const netId = await currentNetId();
  if (!netId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  try {
    return NextResponse.json({ chat: await readChat(netId, (await params).id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof ChatError ? err.message : "Could not load this chat." }, { status: err instanceof ChatError ? err.status : 500 });
  }
}
