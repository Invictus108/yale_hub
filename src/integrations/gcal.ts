/**
 * Jack owns Google Calendar access. Calendar tools call these functions.
 * OAuth tokens and the local event cache live in data/calendar/, not the profile.
 * Without a Google connection, events stay in that cache so the hub still works.
 */

import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const TIME_ZONE = "America/New_York";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location: string | null;
  allDay?: boolean;
}

export interface CalendarEventDraft {
  title: string;
  start: string;
  end: string;
  location?: string;
}

export interface CalendarEventPatch {
  title?: string;
  start?: string;
  end?: string;
  location?: string;
}

export interface GoogleConnection {
  connected: boolean;
  detail: string;
}

interface StoredToken {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
}

interface OAuthState {
  netId: string;
  at: string;
}

const locks = new Map<string, Promise<void>>();

function safeNetId(raw: string): string {
  const netId = raw.trim().toLowerCase();
  if (!/^[a-z][a-z0-9]{1,7}$/.test(netId)) throw new Error("Invalid NetID.");
  return netId;
}

function calendarRoot(): string {
  return path.resolve(process.cwd(), "data", "calendar");
}

function studentDir(netId: string): string {
  return path.join(calendarRoot(), safeNetId(netId));
}

async function withLock<T>(netId: string, fn: () => Promise<T>): Promise<T> {
  const id = safeNetId(netId);
  const previous = locks.get(id) ?? Promise.resolve();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => gate);
  locks.set(id, tail);
  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(id) === tail) locks.delete(id);
  }
}

export function newYorkToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(now);
}

export function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  const yyyy = utc.getUTCFullYear();
  const mm = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(utc.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Interpret a zone-less datetime as America/New_York. Full ISO strings pass through. */
export function parseEventTime(value: string): Date {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Missing a start or end time.");
  if (/[zZ]$/.test(trimmed) || /[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) throw new Error(`Unrecognized time: ${value}`);
    return parsed;
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(trimmed);
  if (!match) {
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) throw new Error(`Unrecognized time: ${value}`);
    return parsed;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  let utc = Date.UTC(year, month - 1, day, hour, minute);
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).formatToParts(new Date(utc));
    const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
    let zonedHour = read("hour");
    if (zonedHour === 24) zonedHour = 0;
    const asUtc = Date.UTC(read("year"), read("month") - 1, read("day"), zonedHour, read("minute"));
    const target = Date.UTC(year, month - 1, day, hour, minute);
    utc += target - asUtc;
  }
  return new Date(utc);
}

export function dayRange(date = newYorkToday()): { timeMin: string; timeMax: string } {
  return {
    timeMin: parseEventTime(`${date}T00:00`).toISOString(),
    timeMax: parseEventTime(`${addCalendarDays(date, 1)}T00:00`).toISOString(),
  };
}

export function upcomingRange(days = 14): { timeMin: string; timeMax: string } {
  const today = newYorkToday();
  return {
    timeMin: parseEventTime(`${today}T00:00`).toISOString(),
    timeMax: parseEventTime(`${addCalendarDays(today, days)}T00:00`).toISOString(),
  };
}

function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

function redirectUri(): string {
  return process.env.GOOGLE_REDIRECT_URI?.trim() || "http://localhost:5000/api/calendar/google/callback";
}

function clientId(): string {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!id) throw new Error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to connect Google Calendar.");
  return id;
}

function clientSecret(): string {
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!secret) throw new Error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to connect Google Calendar.");
  return secret;
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2), "utf8");
}

async function readEvents(netId: string): Promise<CalendarEvent[]> {
  const stored = await readJson<{ events: CalendarEvent[] }>(path.join(studentDir(netId), "events.json"));
  return stored?.events ?? [];
}

async function writeEvents(netId: string, events: CalendarEvent[]): Promise<void> {
  await writeJson(path.join(studentDir(netId), "events.json"), { events });
}

export async function googleConnection(netId: string): Promise<GoogleConnection> {
  if (!googleConfigured()) {
    return {
      connected: false,
      detail: "Google OAuth is not configured. Events stay in the local calendar until GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.",
    };
  }
  const token = await readJson<StoredToken>(path.join(studentDir(netId), "token.json"));
  if (!token?.refreshToken) {
    return { connected: false, detail: "Google Calendar is not connected for this NetID." };
  }
  return { connected: true, detail: "Google Calendar is connected. Auto-update pulls the primary calendar." };
}

export async function googleAuthUrl(netId: string): Promise<string> {
  const id = safeNetId(netId);
  const state = randomBytes(18).toString("hex");
  const states = (await readJson<Record<string, OAuthState>>(path.join(calendarRoot(), "oauth-states.json"))) ?? {};
  const fresh: Record<string, OAuthState> = {};
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [key, value] of Object.entries(states)) {
    if (Date.parse(value.at) >= cutoff) fresh[key] = value;
  }
  fresh[state] = { netId: id, at: new Date().toISOString() };
  await writeJson(path.join(calendarRoot(), "oauth-states.json"), fresh);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId());
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", CALENDAR_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function connectGoogle(netId: string, code: string, state: string): Promise<void> {
  const id = safeNetId(netId);
  const states = (await readJson<Record<string, OAuthState>>(path.join(calendarRoot(), "oauth-states.json"))) ?? {};
  const expected = states[state];
  if (!expected || expected.netId !== id || Date.parse(expected.at) < Date.now() - 15 * 60 * 1000) {
    throw new Error("Google sign-in expired. Start the connection again from the calendar page.");
  }
  delete states[state];
  await writeJson(path.join(calendarRoot(), "oauth-states.json"), states);
  const body = new URLSearchParams({
    code,
    client_id: clientId(),
    client_secret: clientSecret(),
    redirect_uri: redirectUri(),
    grant_type: "authorization_code",
  });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error_description?: string;
    error?: string;
  };
  if (!response.ok || !payload.access_token || !payload.refresh_token) {
    throw new Error(payload.error_description || payload.error || "Google did not return a calendar token.");
  }
  const token: StoredToken = {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  };
  await writeJson(path.join(studentDir(id), "token.json"), token);
}

async function accessToken(netId: string): Promise<string | null> {
  const file = path.join(studentDir(netId), "token.json");
  const token = await readJson<StoredToken>(file);
  if (!token?.refreshToken) return null;
  if (token.expiresAt > Date.now() + 30_000) return token.accessToken;
  const body = new URLSearchParams({
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: token.refreshToken,
    grant_type: "refresh_token",
  });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || "Google Calendar needs to be connected again.");
  }
  const next: StoredToken = {
    accessToken: payload.access_token,
    refreshToken: token.refreshToken,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  };
  await writeJson(file, next);
  return next.accessToken;
}

interface GoogleEventItem {
  id?: string;
  summary?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

function fromGoogle(item: GoogleEventItem): CalendarEvent | null {
  if (!item.id) return null;
  const allDay = Boolean(item.start?.date && !item.start.dateTime);
  const start = item.start?.dateTime ?? (item.start?.date ? parseEventTime(`${item.start.date}T00:00`).toISOString() : "");
  const end = item.end?.dateTime ?? (item.end?.date ? parseEventTime(`${item.end.date}T00:00`).toISOString() : "");
  if (!start || !end) return null;
  return {
    id: item.id,
    title: item.summary?.trim() || "(untitled)",
    start,
    end,
    location: item.location?.trim() || null,
    allDay,
  };
}

function toGoogleBody(draft: CalendarEventDraft): Record<string, unknown> {
  const start = parseEventTime(draft.start);
  const end = parseEventTime(draft.end);
  if (end.getTime() <= start.getTime()) throw new Error("The event end must be after the start.");
  return {
    summary: draft.title.trim(),
    location: draft.location?.trim() || undefined,
    start: { dateTime: start.toISOString(), timeZone: TIME_ZONE },
    end: { dateTime: end.toISOString(), timeZone: TIME_ZONE },
  };
}

async function googleFetch(netId: string, url: string, init?: RequestInit): Promise<Response> {
  const token = await accessToken(netId);
  if (!token) throw new Error("Google Calendar is not connected.");
  const response = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  return response;
}

async function fetchGoogleEvents(netId: string, range: { timeMin: string; timeMax: string }): Promise<CalendarEvent[]> {
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "50");
  url.searchParams.set("timeMin", parseEventTime(range.timeMin).toISOString());
  url.searchParams.set("timeMax", parseEventTime(range.timeMax).toISOString());
  const response = await googleFetch(netId, url.toString());
  const payload = (await response.json()) as { items?: GoogleEventItem[]; error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || `Google Calendar list failed (${response.status}).`);
  return (payload.items ?? []).map(fromGoogle).filter((event): event is CalendarEvent => event !== null);
}

function inRange(event: CalendarEvent, range: { timeMin?: string; timeMax?: string }): boolean {
  const start = range.timeMin ? parseEventTime(range.timeMin).toISOString() : "";
  const end = range.timeMax ? parseEventTime(range.timeMax).toISOString() : "";
  if (start && event.end <= start) return false;
  if (end && event.start >= end) return false;
  return true;
}

function normalizeDraft(draft: CalendarEventDraft): CalendarEventDraft {
  const title = draft.title.trim();
  if (!title) throw new Error("An event needs a title.");
  parseEventTime(draft.start);
  parseEventTime(draft.end);
  return { ...draft, title, location: draft.location?.trim() || undefined };
}

export async function listEvents(
  netId: string,
  range: { timeMin?: string; timeMax?: string } = {},
): Promise<CalendarEvent[]> {
  const id = safeNetId(netId);
  const window = {
    timeMin: range.timeMin ?? upcomingRange().timeMin,
    timeMax: range.timeMax ?? upcomingRange().timeMax,
  };
  const token = await accessToken(id);
  if (token) return fetchGoogleEvents(id, { timeMin: window.timeMin, timeMax: window.timeMax });
  const events = await readEvents(id);
  return events.filter((event) => inRange(event, window)).sort((a, b) => a.start.localeCompare(b.start));
}

export async function createEvent(netId: string, draft: CalendarEventDraft): Promise<CalendarEvent> {
  const id = safeNetId(netId);
  const clean = normalizeDraft(draft);
  return withLock(id, async () => {
    const token = await accessToken(id);
    if (token) {
      const response = await googleFetch(id, "https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        body: JSON.stringify(toGoogleBody(clean)),
      });
      const payload = (await response.json()) as GoogleEventItem & { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Google Calendar could not create the event.");
      const created = fromGoogle(payload);
      if (!created) throw new Error("Google Calendar returned an event without an id.");
      return created;
    }
    const start = parseEventTime(clean.start);
    const end = parseEventTime(clean.end);
    if (end.getTime() <= start.getTime()) throw new Error("The event end must be after the start.");
    const event: CalendarEvent = {
      id: `local:${randomBytes(8).toString("hex")}`,
      title: clean.title,
      start: start.toISOString(),
      end: end.toISOString(),
      location: clean.location ?? null,
    };
    const events = await readEvents(id);
    events.push(event);
    await writeEvents(id, events);
    return event;
  });
}

export async function updateEvent(netId: string, eventId: string, patch: CalendarEventPatch): Promise<CalendarEvent> {
  const id = safeNetId(netId);
  return withLock(id, async () => {
    const token = await accessToken(id);
    if (token && !eventId.startsWith("local:")) {
      const current = await googleFetch(
        id,
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
      );
      const existing = (await current.json()) as GoogleEventItem & { error?: { message?: string } };
      if (!current.ok) throw new Error(existing.error?.message || "That Google Calendar event was not found.");
      const mapped = fromGoogle(existing);
      if (!mapped) throw new Error("That Google Calendar event was not found.");
      const nextDraft: CalendarEventDraft = {
        title: patch.title?.trim() || mapped.title,
        start: patch.start ?? mapped.start,
        end: patch.end ?? mapped.end,
        location: patch.location === undefined ? mapped.location ?? undefined : patch.location,
      };
      const response = await googleFetch(
        id,
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
        { method: "PATCH", body: JSON.stringify(toGoogleBody(nextDraft)) },
      );
      const payload = (await response.json()) as GoogleEventItem & { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message || "Google Calendar could not update the event.");
      const updated = fromGoogle(payload);
      if (!updated) throw new Error("Google Calendar returned an event without an id.");
      return updated;
    }
    const events = await readEvents(id);
    const index = events.findIndex((event) => event.id === eventId);
    const current = events[index];
    if (!current) throw new Error(`No event with id ${eventId}.`);
    const next: CalendarEvent = {
      ...current,
      title: patch.title?.trim() || current.title,
      start: patch.start ? parseEventTime(patch.start).toISOString() : current.start,
      end: patch.end ? parseEventTime(patch.end).toISOString() : current.end,
      location: patch.location === undefined ? current.location : patch.location.trim() || null,
    };
    if (Date.parse(next.end) <= Date.parse(next.start)) throw new Error("The event end must be after the start.");
    events[index] = next;
    await writeEvents(id, events);
    return next;
  });
}

export async function deleteEvent(netId: string, eventId: string): Promise<void> {
  const id = safeNetId(netId);
  await withLock(id, async () => {
    const token = await accessToken(id);
    if (token && !eventId.startsWith("local:")) {
      const response = await googleFetch(
        id,
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
        { method: "DELETE" },
      );
      if (response.status === 204 || response.status === 200) return;
      const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      throw new Error(payload.error?.message || `Google Calendar could not delete the event (${response.status}).`);
    }
    const events = await readEvents(id);
    const next = events.filter((event) => event.id !== eventId);
    if (next.length === events.length) throw new Error(`No event with id ${eventId}.`);
    await writeEvents(id, next);
  });
}

export async function syncGoogleCalendar(netId: string): Promise<{ connected: boolean; detail: string }> {
  const id = safeNetId(netId);
  const connection = await googleConnection(id);
  if (!connection.connected) {
    const local = await readEvents(id);
    return {
      connected: false,
      detail: `${connection.detail} ${local.length} event(s) are stored on this machine.`,
    };
  }
  return withLock(id, async () => {
    const local = await readEvents(id);
    let pushed = 0;
    for (const event of local) {
      if (!event.id.startsWith("local:")) continue;
      const response = await googleFetch(id, "https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        body: JSON.stringify(
          toGoogleBody({
            title: event.title,
            start: event.start,
            end: event.end,
            location: event.location ?? undefined,
          }),
        ),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: { message?: string } };
        throw new Error(payload.error?.message || "Could not upload a local event to Google Calendar.");
      }
      pushed += 1;
    }
    const remote = await fetchGoogleEvents(id, upcomingRange(21));
    await writeEvents(id, remote);
    const uploaded = pushed ? ` Uploaded ${pushed} local event(s).` : "";
    return {
      connected: true,
      detail: `Pulled ${remote.length} upcoming event(s) from Google Calendar.${uploaded}`,
    };
  });
}

export function formatEventLine(event: CalendarEvent): string {
  if (event.allDay) {
    const day = new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(event.start));
    const where = event.location ? ` @ ${event.location}` : "";
    return `${day} (all day) — ${event.title}${where} [${event.id}]`;
  }
  const start = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(event.start));
  const end = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(event.end));
  const where = event.location ? ` @ ${event.location}` : "";
  return `${start}–${end} — ${event.title}${where} [${event.id}]`;
}
