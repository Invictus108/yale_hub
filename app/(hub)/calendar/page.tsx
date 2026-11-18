import { SignInGate } from "../../components/gate";
import { currentNetId } from "../../lib/session";
import { googleConnection, listEvents, upcomingRange } from "../../../src/integrations/gcal";
import { calendarAutoUpdateStatus } from "../../../src/modules/calendar/auto-update";
import { DeleteEventButton, EventForm } from "./event-form";
import { SyncButton } from "./sync-button";

/** Jack owns this page and the auto-update logic it calls. */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const netId = await currentNetId();
  const query = await searchParams;
  if (!netId) {
    return <SignInGate title="Calendar" detail="Sign in to see upcoming events and connect Google Calendar." />;
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
      <header className="page-head">
        <p className="eyebrow">Calendar</p>
        <h1>Make time for what matters.</h1>
        <p className="lede">
          Your next two weeks, all in one place.{" "}
          {connection.connected ? null : <a href="/api/calendar/google">Connect Google Calendar</a>}
        </p>
      </header>
      <div className="stack">
        {query.connected ? <p className="status">Google Calendar is connected.</p> : null}
        {query.error ? <p className="banner">{query.error}</p> : null}
        <section className="panel">
          <h2>Next two weeks</h2>
          {failed ? <p className="banner">{failed}</p> : null}
          {listed.length === 0 && !failed ? <p className="muted">No events in the next two weeks.</p> : null}
          {listed.length ? (
            <ul className="event-list">
              {listed.map((event) => (
                <li key={event.id} className="event-row">
                  <div className="event-date"><span>{new Intl.DateTimeFormat("en-US", { month: "short", timeZone: event.allDay ? "UTC" : "America/New_York" }).format(new Date(event.start))}</span><strong>{new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: event.allDay ? "UTC" : "America/New_York" }).format(new Date(event.start))}</strong></div>
                  <div className="event-info"><h3>{event.title}</h3><p>{event.allDay ? "All day" : `${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).format(new Date(event.start))} – ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).format(new Date(event.end))}`}{event.location ? ` · ${event.location}` : ""}</p></div>
                  <DeleteEventButton id={event.id} />
                </li>
              ))}
            </ul>
          ) : null}
        </section>
        <section className="panel">
          <h2>Add an event</h2>
          <p className="muted">Plan something to look forward to. All times are Eastern.</p>
          <EventForm />
        </section>
        <section className="panel">
          <h2>Calendar connection</h2>
          <p><span className="pill">{status.status}</span></p>
          <p className="muted">{status.detail}</p>
          {status.lastRunAt ? <p className="muted">Last run {status.lastRunAt}</p> : null}
          <SyncButton />
        </section>
      </div>
    </>
  );
}
