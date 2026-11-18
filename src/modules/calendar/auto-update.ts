/**
 * Jack owns automatic Google Calendar updates.
 * A run pulls the primary calendar when Google is connected, and uploads
 * events that were created locally before that connection.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { syncGoogleCalendar } from "../../integrations/gcal.js";

export interface CalendarAutoUpdateStatus {
  lastRunAt: string | null;
  status: "idle" | "local" | "synced" | "error";
  detail: string;
}

function fileFor(netId: string): string {
  const id = netId.trim().toLowerCase();
  return path.resolve(process.cwd(), "data", "calendar", id, "auto-update.json");
}

export async function calendarAutoUpdateStatus(netId: string): Promise<CalendarAutoUpdateStatus> {
  try {
    return JSON.parse(await readFile(fileFor(netId), "utf8")) as CalendarAutoUpdateStatus;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        lastRunAt: null,
        status: "idle",
        detail: "Automatic Google Calendar sync has not run.",
      };
    }
    throw err;
  }
}

export async function runCalendarAutoUpdate(netId: string): Promise<CalendarAutoUpdateStatus> {
  let status: CalendarAutoUpdateStatus;
  try {
    const result = await syncGoogleCalendar(netId);
    status = {
      lastRunAt: new Date().toISOString(),
      status: result.connected ? "synced" : "local",
      detail: result.detail,
    };
  } catch (err) {
    status = {
      lastRunAt: new Date().toISOString(),
      status: "error",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
  const file = fileFor(netId);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(status, null, 2), "utf8");
  return status;
}
