import { NextResponse } from "next/server";

import { currentNetId } from "../../../lib/session.js";
import { sameOrigin } from "../../../../src/core/auth.js";
import { googleAuthUrl } from "../../../../src/integrations/gcal.js";

export async function GET(request: Request) {
  const netId = await currentNetId();
  if (!netId) return NextResponse.redirect(sameOrigin(request, "/login"));
  try {
    return NextResponse.redirect(await googleAuthUrl(netId));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(sameOrigin(request, `/calendar?error=${encodeURIComponent(message)}`));
  }
}
