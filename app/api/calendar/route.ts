import { NextResponse } from "next/server";

import { currentNetId } from "../../lib/session.js";
import { calendarAutoUpdateStatus, runCalendarAutoUpdate } from "../../../src/modules/calendar/auto-update.js";

export async function GET() {
  const netId = await currentNetId();
  if (!netId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  return NextResponse.json({
    events: [],
    note: "TODO(jack): return Google Calendar events.",
    autoUpdate: calendarAutoUpdateStatus(netId),
  });
}

export async function POST() {
  const netId = await currentNetId();
  if (!netId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  return NextResponse.json(await runCalendarAutoUpdate(netId));
}
