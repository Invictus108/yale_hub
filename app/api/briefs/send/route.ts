import { NextResponse } from "next/server";

import { currentNetId } from "../../../lib/session";
import { morningBriefFor } from "../../../../src/core/mcp-server";
import { loadOrCreateProfile } from "../../../../src/core/memory/profile";
import { sendMorningEmail } from "../../../../src/modules/briefs/email";

export async function POST() {
  const netId = await currentNetId();
  if (!netId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const profile = await loadOrCreateProfile(netId);
  const text = await morningBriefFor(netId);
  const result = await sendMorningEmail({
    to: profile.email ?? `${netId}@yale.edu`,
    subject: "YaleHub morning brief",
    text,
  });
  return NextResponse.json(result);
}
