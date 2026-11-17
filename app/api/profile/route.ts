import { NextResponse } from "next/server";

import { currentNetId } from "../../lib/session.js";
import { loadOrCreateProfile, patchProfile } from "../../../src/core/memory/profile.js";

export async function GET() {
  const netId = await currentNetId();
  if (!netId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  return NextResponse.json(await loadOrCreateProfile(netId));
}

export async function POST(request: Request) {
  const netId = await currentNetId();
  if (!netId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = (await request.json()) as {
    displayName?: unknown;
    college?: unknown;
    classYear?: unknown;
    major?: unknown;
    pronouns?: unknown;
  };
  const classYear = body.classYear === "" || body.classYear == null ? null : Number(body.classYear);
  const profile = await patchProfile(netId, {
    displayName: typeof body.displayName === "string" ? body.displayName : undefined,
    college: typeof body.college === "string" ? body.college || null : undefined,
    classYear: classYear != null && Number.isFinite(classYear) ? classYear : null,
    major: typeof body.major === "string" ? body.major || null : undefined,
    pronouns: typeof body.pronouns === "string" ? body.pronouns || null : undefined,
  });
  return NextResponse.json(profile);
}
