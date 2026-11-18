import { NextResponse } from "next/server";

import { currentNetId } from "../../../lib/session.js";
import { morningBriefFor } from "../../../../src/core/mcp-server.js";
import { loadOrCreateProfile } from "../../../../src/core/memory/profile.js";
import { sendMorningEmail } from "../../../../src/modules/briefs/email.js";

export async function POST() {
  const netId = await currentNetId();
  if (!netId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const profile = await loadOrCreateProfile(netId);
  const text = await morningBriefFor(netId);
  const result = await sendMorningEmail({
    to: profile.email ?? `${netId}@yale.edu`,
    subject: "YaleHub morning brief",
    text,
    netId,
  });
  return NextResponse.json(result);
}
