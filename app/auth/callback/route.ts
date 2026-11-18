import { NextResponse } from "next/server";

import {
  createSession,
  sameOrigin,
  serviceUrlFor,
  SESSION_COOKIE,
  sessionCookieOptions,
  validateYaleTicket,
} from "../../../src/core/auth.js";

/** Yale CAS returns the browser here. Service URL is http://host/auth/callback. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ticket = url.searchParams.get("ticket");
  if (!ticket) {
    return NextResponse.json({ error: "Missing CAS ticket." }, { status: 400 });
  }
  const host = request.headers.get("host") ?? "127.0.0.1:3000";
  const netId = await validateYaleTicket(ticket, serviceUrlFor(host));
  const response = NextResponse.redirect(sameOrigin(request, "/"));
  response.cookies.set(SESSION_COOKIE, createSession(netId), sessionCookieOptions);
  return response;
}
