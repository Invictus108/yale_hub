import { after, NextResponse } from "next/server";
import { refreshCampus } from "../../../../src/core/memory/campus";

import { casMode, createSession, parseNetIdBody, sameOrigin, SESSION_COOKIE, sessionCookieOptions } from "../../../../src/core/auth";

export async function POST(request: Request) {
  if (casMode() !== "mock") {
    return NextResponse.json({ error: "Sign in through Yale CAS." }, { status: 403 });
  }
  const raw = await request.text();
  const netId = parseNetIdBody(raw, request.headers.get("content-type") ?? "");
  const token = createSession(netId);
  const response = NextResponse.redirect(sameOrigin(request, "/chat"), 303);
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  after(async () => { await refreshCampus(netId, true); });
  return response;
}
