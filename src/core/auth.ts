import { createHmac, timingSafeEqual } from "node:crypto";

import { assertNetId } from "./memory/profile";

const YALE_CAS_BASE = "https://secure.its.yale.edu/cas";
export const SESSION_COOKIE = "yalehub";
const WEEK = 60 * 60 * 24 * 7;

function sessionSecret(): string {
  return process.env.SESSION_SECRET?.trim() || "yalehub-localhost";
}

function signNetId(netId: string): string {
  return createHmac("sha256", sessionSecret()).update(netId).digest("hex");
}

export function casMode(): "mock" | "yale" {
  return process.env.CAS_MODE?.trim().toLowerCase() === "yale" ? "yale" : "mock";
}

export function serviceUrlFor(host: string): string {
  return `http://${host}/auth/callback`;
}

export function loginRedirectFor(host: string): string {
  return `${YALE_CAS_BASE}/login?service=${encodeURIComponent(serviceUrlFor(host))}`;
}

/** Signed cookie payload. Survives a server restart. Logout clears the cookie. */
export function createSession(netId: string): string {
  const id = assertNetId(netId);
  return `${id}.${signNetId(id)}`;
}

export function endSession(_token: string | null | undefined): void {
  // Stateless session. The logout route clears the cookie.
}

export function netIdFromToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let netId: string;
  try {
    netId = assertNetId(id);
  } catch {
    return null;
  }
  const expected = signNetId(netId);
  const actual = Buffer.from(sig);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted)) return null;
  return netId;
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

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: WEEK,
};
