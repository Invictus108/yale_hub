import { NextResponse } from "next/server";
import { currentNetId } from "../../../lib/session";
import { createChat, listChats } from "../../../../src/core/memory/chat-store";
import { readCampus } from "../../../../src/core/memory/campus";

export async function GET() {
  const netId = await currentNetId();
  if (!netId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  return NextResponse.json({ chats: await listChats(netId) }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST() {
  const netId = await currentNetId();
  if (!netId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const snapshot = await readCampus(netId);
  return NextResponse.json({ chat: await createChat(netId, snapshot?.greeting) }, { status: 201 });
}
