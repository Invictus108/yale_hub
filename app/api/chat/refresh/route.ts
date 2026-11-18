import { after, NextResponse } from "next/server";
import { currentNetId } from "../../../lib/session";
import { readCampus, refreshCampus } from "../../../../src/core/memory/campus";
export const maxDuration = 60;

export async function GET() {
  const netId = await currentNetId();
  if (!netId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  return NextResponse.json({ snapshot: await readCampus(netId) }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(request: Request) {
  const netId = await currentNetId();
  if (!netId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const force = new URL(request.url).searchParams.get("force") === "true";
  const snapshot = await readCampus(netId);
  after(async () => { await refreshCampus(netId, force); });
  return NextResponse.json({ snapshot, refreshing: true }, { status: 202 });
}
