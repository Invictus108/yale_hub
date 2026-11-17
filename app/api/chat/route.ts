import { NextResponse } from "next/server";

import { currentNetId } from "../../lib/session.js";
import { answerQuestion } from "../../../src/core/agent.js";

export async function POST(request: Request) {
  const netId = await currentNetId();
  if (!netId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = (await request.json()) as { message?: unknown };
  if (typeof body.message !== "string" || !body.message.trim()) {
    return NextResponse.json({ error: "message is required." }, { status: 400 });
  }
  const turn = await answerQuestion(netId, body.message.trim());
  return NextResponse.json(turn);
}
