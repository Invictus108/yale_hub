import { NextResponse } from "next/server";

import { currentNetId } from "../../lib/session.js";
import { loadOrCreateProfile } from "../../../src/core/memory/profile.js";
import { getDiningMenu, mealForNow, newYorkToday, preferredHall, type DiningMenu } from "../../../src/integrations/nutrislice.js";

export async function GET(request: Request) {
  const netId = await currentNetId();
  if (!netId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const url = new URL(request.url);
  const profile = await loadOrCreateProfile(netId);
  const requested = url.searchParams.get("hall") ?? "";
  const hall = requested || preferredHall(profile.college, profile.preferences.dining.hall)?.name;
  if (!hall) return NextResponse.json({ error: "Name a dining hall, or set a residential college on the profile." }, { status: 400 });
  const date = url.searchParams.get("date") || newYorkToday();
  const mealParam = url.searchParams.get("meal");
  const meal: DiningMenu["meal"] =
    mealParam === "breakfast" || mealParam === "lunch" || mealParam === "dinner" ? mealParam : mealForNow();
  try {
    return NextResponse.json(await getDiningMenu(hall, date, meal));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
