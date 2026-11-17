import Link from "next/link";

import { currentNetId } from "../lib/session";
import { calendarAutoUpdateStatus } from "../../src/modules/calendar/auto-update";
import { SyncButton } from "./sync-button";

/** Jack owns this page and the auto-update logic it calls. */
export default async function CalendarPage() {
  const netId = await currentNetId();
  if (!netId) {
    return (
      <>
        <h1>Calendar</h1>
        <p><Link href="/login">Sign in</Link> to see your calendar.</p>
      </>
    );
  }
  const status = calendarAutoUpdateStatus(netId);
  return (
    <>
      <h1>Calendar</h1>
      <p>TODO(jack): list upcoming Google Calendar events here.</p>
      <h2>Automatic updates</h2>
      <p>Status: {status.status}</p>
      <p>{status.detail}</p>
      {status.lastRunAt ? <p>Last run: {status.lastRunAt}</p> : null}
      <SyncButton />
    </>
  );
}
