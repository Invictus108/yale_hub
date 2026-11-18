import Link from "next/link";

import { currentNetId } from "../lib/session.js";
import { loadOrCreateProfile } from "../../src/core/memory/profile.js";
import {
  DINING_HALLS,
  formatDiningMenu,
  getDiningMenu,
  mealForNow,
  newYorkToday,
  preferredHall,
  type DiningMenu,
} from "../../src/integrations/nutrislice.js";

/** Aiden owns this page. */
export default async function DiningPage({
  searchParams,
}: {
  searchParams: Promise<{ hall?: string; date?: string; meal?: string }>;
}) {
  const netId = await currentNetId();
  const query = await searchParams;
  if (!netId) {
    return (
      <>
        <h1>Dining</h1>
        <p><Link href="/login">Sign in</Link> to see a menu.</p>
      </>
    );
  }
  const profile = await loadOrCreateProfile(netId);
  const preferred = preferredHall(profile.college, profile.preferences.dining.hall);
  const hall = query.hall || preferred?.slug || DINING_HALLS[0]?.slug || "berkeley-college";
  const date = query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : newYorkToday();
  const meal: DiningMenu["meal"] =
    query.meal === "breakfast" || query.meal === "lunch" || query.meal === "dinner" ? query.meal : mealForNow();
  let menuText = "";
  let error = "";
  try {
    menuText = formatDiningMenu(await getDiningMenu(hall, date, meal));
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  return (
    <>
      <h1>Dining</h1>
      <p>Menus come from Yale Hospitality on Nutrislice. {preferred ? `Your college is ${preferred.name}.` : "Set a residential college on the profile to pin a hall."}</p>
      <form method="get">
        <label>
          Hall
          <select name="hall" defaultValue={hall}>
            {DINING_HALLS.map((item) => (
              <option key={item.slug} value={item.slug}>{item.name}</option>
            ))}
          </select>
        </label>
        <label>
          Date
          <input name="date" type="date" defaultValue={date} required />
        </label>
        <label>
          Meal
          <select name="meal" defaultValue={meal}>
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
          </select>
        </label>
        <button type="submit">Show menu</button>
      </form>
      {error ? <p>{error}</p> : <pre>{menuText}</pre>}
    </>
  );
}
