import { NextResponse } from "next/server";

import { currentNetId } from "../../../lib/session";
import { createEvent, deleteEvent } from "../../../../src/integrations/gcal";

export async function POST(request: Request) {
  const netId = await currentNetId();
  if (!netId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = (await request.json()) as { title?: unknown; start?: unknown; end?: unknown; location?: unknown };
  try {
    const event = await createEvent(netId, {
      title: typeof body.title === "string" ? body.title : "",
      start: typeof body.start === "string" ? body.start : "",
      end: typeof body.end === "string" ? body.end : "",
      location: typeof body.location === "string" ? body.location : undefined,
    });
    return NextResponse.json(event);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const netId = await currentNetId();
  if (!netId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  try {
    await deleteEvent(netId, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
