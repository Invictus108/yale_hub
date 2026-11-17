import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { endSession, SESSION_COOKIE } from "../../../../src/core/auth.js";

export async function GET(request: Request) {
  const jar = await cookies();
  endSession(jar.get(SESSION_COOKIE)?.value);
  const response = NextResponse.redirect(new URL("/", request.url));
  response.cookies.set(SESSION_COOKIE, "", { ...sessionClear() });
  return response;
}

function sessionClear() {
  return { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 0 };
}
