import { NextResponse } from "next/server";

import { currentNetId } from "../../../../lib/session";
import { sameOrigin } from "../../../../../src/core/auth";
import { connectGoogle } from "../../../../../src/integrations/gcal";

export async function GET(request: Request) {
  const netId = await currentNetId();
  const url = new URL(request.url);
  if (!netId) return NextResponse.redirect(sameOrigin(request, "/login"));
  const oauthError = url.searchParams.get("error");
  if (oauthError) {
    return NextResponse.redirect(sameOrigin(request, `/calendar?error=${encodeURIComponent(oauthError)}`));
  }
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return NextResponse.redirect(sameOrigin(request, "/calendar?error=Missing+Google+authorization+code."));
  }
  try {
    await connectGoogle(netId, code, state);
    return NextResponse.redirect(sameOrigin(request, "/calendar?connected=1"));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(sameOrigin(request, `/calendar?error=${encodeURIComponent(message)}`));
  }
}
