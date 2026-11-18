import { randomBytes } from "node:crypto";

import { assertNetId } from "./memory/profile.js";

const YALE_CAS_BASE = "https://secure.its.yale.edu/cas";
export const SESSION_COOKIE = "yalehub";
const WEEK = 60 * 60 * 24 * 7;

interface Session {
  netId: string;
}

const globalSessions = globalThis as typeof globalThis & { __yalehubSessions?: Map<string, Session> };
const sessions = globalSessions.__yalehubSessions ?? new Map<string, Session>();
globalSessions.__yalehubSessions = sessions;

export function casMode(): "mock" | "yale" {
  return process.env.CAS_MODE?.trim().toLowerCase() === "yale" ? "yale" : "mock";
}

export function serviceUrlFor(host: string): string {
  return `http://${host}/auth/callback`;
}

export function loginRedirectFor(host: string): string {
  return `${YALE_CAS_BASE}/login?service=${encodeURIComponent(serviceUrlFor(host))}`;
}

export function createSession(netId: string): string {
  const token = randomBytes(24).toString("hex");
  sessions.set(token, { netId: assertNetId(netId) });
  return token;
}

export function endSession(token: string | null | undefined): void {
  if (token) sessions.delete(token);
}

export function netIdFromToken(token: string | null | undefined): string | null {
  if (!token) return null;
  return sessions.get(token)?.netId ?? null;
}

/**
 * Localhost identity. Mock mode also accepts X-NetID so curl works.
 * Yale mode ignores that header and trusts only a CAS session cookie.
 */
export function identifyToken(token: string | null | undefined, xNetId: string | null | undefined): string | null {
  const fromCookie = netIdFromToken(token);
  if (fromCookie) return fromCookie;
  if (casMode() !== "mock" || !xNetId) return null;
  try {
    return assertNetId(xNetId);
  } catch {
    return null;
  }
}

export function parseNetIdBody(raw: string, contentType: string): string {
  if (contentType.includes("application/json")) {
    const body = JSON.parse(raw) as { netId?: unknown };
    if (typeof body.netId !== "string") throw new Error("netId is required.");
    return assertNetId(body.netId);
  }
  const params = new URLSearchParams(raw);
  return assertNetId(params.get("netId") ?? "");
}

/** Validate a Yale CAS service ticket. `service` must match the login redirect. */
export async function validateYaleTicket(ticket: string, service: string): Promise<string> {
  const url = new URL(`${YALE_CAS_BASE}/serviceValidate`);
  url.searchParams.set("service", service);
  url.searchParams.set("ticket", ticket);
  const response = await fetch(url);
  const xml = await response.text();
  if (!response.ok) {
    throw new Error(`Yale CAS validation failed (${response.status}).`);
  }
  const failure = /<(?:cas:)?authenticationFailure[^>]*>([^<]*)</i.exec(xml);
  if (failure) {
    throw new Error(failure[1]?.trim() || "Yale CAS rejected the ticket.");
  }
  const user = /<(?:cas:)?user>([^<]+)<\/(?:cas:)?user>/i.exec(xml);
  if (!user?.[1]) throw new Error("Yale CAS response did not include a NetID.");
  return assertNetId(user[1]);
}

/** Keep redirects on the host the browser actually opened. Next otherwise rewrites 127.0.0.1 to localhost and drops the session cookie. */
export function sameOrigin(request: Request, path: string): URL {
  const host = request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const base = host ? `${proto}://${host}` : request.url;
  return new URL(path, base);
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: WEEK,
};
