import { NextResponse } from "next/server";

import { currentNetId } from "../../lib/session";
import { loadOrCreateProfile, patchProfile } from "../../../src/core/memory/profile";

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
  const profile = await patchProfile(netId, {
    displayName: typeof body.displayName === "string" ? body.displayName : undefined,
    college: optionalText(body.college),
    classYear: optionalYear(body.classYear),
    major: optionalText(body.major),
    pronouns: optionalText(body.pronouns),
  });
  return NextResponse.json(profile);
}

/** Empty string clears the field. A missing field leaves the stored value. */
function optionalText(value: unknown): string | null | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function optionalYear(value: unknown): number | null | undefined {
  if (value == null || value === "") return value === undefined ? undefined : null;
  const year = typeof value === "number" ? value : Number(value);
  return Number.isFinite(year) ? year : null;
}
