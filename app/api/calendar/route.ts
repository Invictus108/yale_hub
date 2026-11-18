import { NextResponse } from "next/server";

import { currentNetId } from "../../lib/session.js";
import { formatEventLine, googleConnection, listEvents, upcomingRange } from "../../../src/integrations/gcal.js";
import { calendarAutoUpdateStatus, runCalendarAutoUpdate } from "../../../src/modules/calendar/auto-update.js";

export async function GET() {
  const netId = await currentNetId();
  if (!netId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  try {
    const [events, connection, autoUpdate] = await Promise.all([
      listEvents(netId, upcomingRange()),
      googleConnection(netId),
      calendarAutoUpdateStatus(netId),
    ]);
    return NextResponse.json({
      connection,
      autoUpdate,
      events: events.map((event) => ({ ...event, line: formatEventLine(event) })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST() {
  const netId = await currentNetId();
  if (!netId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  return NextResponse.json(await runCalendarAutoUpdate(netId));
}
