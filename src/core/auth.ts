import { createHmac, timingSafeEqual } from "node:crypto";

import { assertNetId } from "./memory/profile";

/**
 * Yale test CAS, same hosts and callback shape as Yale_Books.
 * Test CAS is allowlisted for http://localhost:5000/login_callback.
 * Any other public origin returns "Not Authorized to this service"
 * until ITS registers it.
 */
const CAS_LOGIN_URL = "https://secure-tst.its.yale.edu/cas/login";
const CAS_VALIDATE_URL = "https://secure-tst.its.yale.edu/cas/p3/serviceValidate";

export const SESSION_COOKIE = "yalehub";
const WEEK = 60 * 60 * 24 * 7;

function sessionSecret(): string {
  return process.env.SESSION_SECRET?.trim() || "yalehub-localhost";
}

function signNetId(netId: string): string {
  return createHmac("sha256", sessionSecret()).update(netId).digest("hex");
}

/** `mock` is a local NetID form. Anything else uses Yale test CAS. */
export function casMode(): "mock" | "yale" {
  return process.env.CAS_MODE?.trim().toLowerCase() === "mock" ? "mock" : "yale";
}

export function casLoginUrl(): string {
  return process.env.CAS_LOGIN_URL?.trim() || CAS_LOGIN_URL;
}

export function casValidateUrl(): string {
  return process.env.CAS_VALIDATE_URL?.trim() || CAS_VALIDATE_URL;
}

/** APP_BASE_URL and ORIGIN are aliases, matching Yale_Books. */
export function appOrigin(): string {
  return (process.env.APP_BASE_URL || process.env.ORIGIN || "http://localhost:5000").trim().replace(/\/$/, "");
}

export function serviceUrl(): string {
  return `${appOrigin()}/login_callback`;
}

export function loginRedirectUrl(): string {
  const url = new URL(casLoginUrl());
  url.searchParams.set("service", serviceUrl());
  return url.toString();
}

export function casPublicStatus(): {
  cas_login_url: string;
  cas_validate_url: string;
  service_url: string;
  note: string;
} {
  return {
    cas_login_url: casLoginUrl(),
    cas_validate_url: casValidateUrl(),
    service_url: serviceUrl(),
    note: "Yale test CAS allows http://localhost:5000/login_callback. Other origins return 'Not Authorized to this service' until ITS allowlists them.",
  };
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

function decodeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

function attr(raw: string, name: string): string | undefined {
  const match = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(raw);
  const value = match?.[1] ?? match?.[2];
  return value ? decodeXml(value) : undefined;
}

/**
 * Read a NetID from a CAS serviceValidate document.
 * Accepts both `cas:` prefixed tags and bare tags, same as the Yale_Books parser.
 */
export function netIdFromCasXml(xml: string): string {
  const failure = /<(?:[\w.-]+:)?authenticationFailure\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?authenticationFailure>/i.exec(xml);
  if (failure) {
    const code = attr(failure[1] ?? "", "code");
    const text = decodeXml((failure[2] ?? "").replace(/<[^>]+>/g, " "));
    throw new Error(`CAS Authentication failed: ${code || text || "UNKNOWN"}`);
  }

  const success = /<(?:[\w.-]+:)?authenticationSuccess\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?authenticationSuccess>/i.exec(xml);
  if (!success) throw new Error("CAS returned no authenticationSuccess node");

  const user = /<(?:[\w.-]+:)?user\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?user>/i.exec(success[1] ?? "");
  const netId = decodeXml((user?.[1] ?? "").replace(/<[^>]+>/g, " ")).toLowerCase();
  if (!netId) throw new Error("CAS success response missing user/NetID");
  return netId;
}

/** Validate a Yale CAS service ticket. The service string must match the login redirect. */
export async function validateTicket(ticket: string): Promise<string> {
  const url = new URL(casValidateUrl());
  url.searchParams.set("ticket", ticket);
  url.searchParams.set("service", serviceUrl());
  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const xml = await response.text();
  if (!response.ok) {
    throw new Error(`CAS validation failed (${response.status}).`);
  }
  return assertNetId(netIdFromCasXml(xml));
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
