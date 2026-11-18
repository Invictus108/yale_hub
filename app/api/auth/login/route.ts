import { NextResponse } from "next/server";

import { createSession, parseNetIdBody, sameOrigin, SESSION_COOKIE, sessionCookieOptions } from "../../../../src/core/auth";

export async function POST(request: Request) {
  const raw = await request.text();
  const netId = parseNetIdBody(raw, request.headers.get("content-type") ?? "");
  const token = createSession(netId);
  const response = NextResponse.redirect(sameOrigin(request, "/"), 303);
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return response;
}
