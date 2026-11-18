import { NextResponse } from "next/server";

import { currentNetId } from "../../lib/session";
import { searchCourses } from "../../../src/modules/courses/catalog";
import { listSavedCourses, removeCourse, saveCourse } from "../../../src/modules/courses/worksheet";

export async function GET(request: Request) {
  const netId = await currentNetId();
  if (!netId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const query = new URL(request.url).searchParams.get("q") ?? "";
  if (!query.trim()) {
    return NextResponse.json({ saved: await listSavedCourses(netId) });
  }
  try {
    const found = await searchCourses(query);
    return NextResponse.json({ ...found, saved: await listSavedCourses(netId) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const netId = await currentNetId();
  if (!netId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = (await request.json()) as { action?: unknown; crn?: unknown; seasonCode?: unknown };
  const crn = Number(body.crn);
  const season = typeof body.seasonCode === "string" ? body.seasonCode : undefined;
  try {
    if (body.action === "remove") {
      const removed = await removeCourse(netId, crn, season);
      return NextResponse.json({ removed });
    }
    const saved = await saveCourse(netId, crn, season);
    return NextResponse.json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
