/**
 * Jack owns automatic Google Calendar updates.
 * Call this on a schedule or after a course/dining change. Chat tools live in tools.ts.
 */

export interface CalendarAutoUpdateStatus {
  lastRunAt: string | null;
  status: "idle" | "stub";
  detail: string;
}

const runs = new Map<string, CalendarAutoUpdateStatus>();

export function calendarAutoUpdateStatus(netId: string): CalendarAutoUpdateStatus {
  return (
    runs.get(netId) ?? {
      lastRunAt: null,
      status: "idle",
      detail: "TODO(jack): automatic Google Calendar sync has not run.",
    }
  );
}

export async function runCalendarAutoUpdate(netId: string): Promise<CalendarAutoUpdateStatus> {
  const status: CalendarAutoUpdateStatus = {
    lastRunAt: new Date().toISOString(),
    status: "stub",
    detail: "TODO(jack): write Yale events into Google Calendar for " + netId + ".",
  };
  runs.set(netId, status);
  return status;
}
