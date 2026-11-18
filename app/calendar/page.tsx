import Link from "next/link";

import { currentNetId } from "../lib/session.js";
import { formatEventLine, googleConnection, listEvents, upcomingRange } from "../../src/integrations/gcal.js";
import { calendarAutoUpdateStatus } from "../../src/modules/calendar/auto-update.js";
import { DeleteEventButton, EventForm } from "./event-form.js";
import { SyncButton } from "./sync-button.js";

/** Jack owns this page and the auto-update logic it calls. */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const netId = await currentNetId();
  const query = await searchParams;
  if (!netId) {
    return (
      <>
        <h1>Calendar</h1>
        <p><Link href="/login">Sign in</Link> to see your calendar.</p>
      </>
    );
  }
  const [status, connection, events] = await Promise.all([
    calendarAutoUpdateStatus(netId),
    googleConnection(netId),
    listEvents(netId, upcomingRange()).catch((err: unknown) => err),
  ]);
  const failed = events instanceof Error ? events.message : null;
  const listed = Array.isArray(events) ? events : [];
  return (
    <>
      <h1>Calendar</h1>
      {query.connected ? <p>Google Calendar is connected.</p> : null}
      {query.error ? <p>{query.error}</p> : null}
      <p>
        {connection.detail}{" "}
        {connection.connected ? null : <Link href="/api/calendar/google">Connect Google Calendar</Link>}
      </p>
      <h2>Upcoming</h2>
      {failed ? <p>{failed}</p> : null}
      {listed.length === 0 && !failed ? <p>No events in the next two weeks.</p> : null}
      {listed.length ? (
        <ul>
          {listed.map((event) => (
            <li key={event.id}>
              {formatEventLine(event)} <DeleteEventButton id={event.id} />
            </li>
          ))}
        </ul>
      ) : null}
      <h2>Add an event</h2>
      <p>Times are America/New_York. They go to Google Calendar once it is connected.</p>
      <EventForm />
      <h2>Automatic updates</h2>
      <p>Status: {status.status}</p>
      <p>{status.detail}</p>
      {status.lastRunAt ? <p>Last run: {status.lastRunAt}</p> : null}
      <SyncButton />
    </>
  );
}
