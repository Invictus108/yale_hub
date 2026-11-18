import { NextResponse } from "next/server";

import { createSession, sameOrigin, SESSION_COOKIE, sessionCookieOptions, validateTicket } from "../../src/core/auth";

/** Yale test CAS returns the browser here. Service URL is http://localhost:5000/login_callback. */
export async function GET(request: Request) {
  const ticket = new URL(request.url).searchParams.get("ticket");
  if (!ticket) {
    return NextResponse.redirect(sameOrigin(request, "/login?error=Missing+CAS+ticket."));
  }
  try {
    const netId = await validateTicket(ticket);
    const response = NextResponse.redirect(sameOrigin(request, "/"));
    response.cookies.set(SESSION_COOKIE, createSession(netId), sessionCookieOptions);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "CAS sign-in failed.";
    return NextResponse.redirect(sameOrigin(request, `/login?error=${encodeURIComponent(message)}`));
  }
}
