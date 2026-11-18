import { SignInGate } from "../../components/gate";
import { currentNetId } from "../../lib/session";
import { loadOrCreateProfile } from "../../../src/core/memory/profile";
import {
  DINING_HALLS,
  getDiningMenu,
  mealForNow,
  newYorkToday,
  preferredHall,
  type DiningMenu,
} from "../../../src/integrations/nutrislice";

/** Aiden owns this page. */
export default async function DiningPage({
  searchParams,
}: {
  searchParams: Promise<{ hall?: string; date?: string; meal?: string }>;
}) {
  const netId = await currentNetId();
  const query = await searchParams;
  if (!netId) {
    return <SignInGate title="Dining" detail="Sign in to see a Yale Hospitality menu." />;
  }
  const profile = await loadOrCreateProfile(netId);
  const preferred = preferredHall(profile.college, profile.preferences.dining.hall);
  const hall = query.hall || preferred?.slug || DINING_HALLS[0]?.slug || "berkeley-college";
  const date = query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : newYorkToday();
  const meal: DiningMenu["meal"] =
    query.meal === "breakfast" || query.meal === "lunch" || query.meal === "dinner" ? query.meal : mealForNow();
  let menu: DiningMenu | null = null;
  let error = "";
  try {
    menu = await getDiningMenu(hall, date, meal);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  return (
    <>
      <header className="page-head">
        <p className="eyebrow">Dining</p>
        <h1>Something good is on the menu.</h1>
        <p className="lede">
          Explore today’s offerings from Yale Hospitality.
          {preferred ? ` Your college is ${preferred.name}.` : " Set a residential college on the profile to pin a hall."}
        </p>
      </header>
      <form className="panel" method="get">
        <div className="fields">
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
        </div>
        <button type="submit">Show menu</button>
      </form>
      {error ? <p className="banner">{error}</p> : menu && <section className="menu-sheet">
        <header className="menu-heading"><p className="eyebrow">Yale Hospitality · {meal}</p><h2>{menu.hall}</h2><p className="muted">{new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric" }).format(new Date(`${date}T12:00:00-05:00`))}</p></header>
        {menu.items.length ? <div className="menu-stations">{Array.from(new Set(menu.items.map((item) => item.station || "On the menu"))).map((station) => <section key={station}><h3>{station}</h3><ul>{menu.items.filter((item) => (item.station || "On the menu") === station).map((item, index) => <li key={index}>{item.name}</li>)}</ul></section>)}</div> : <div className="empty"><p className="muted">No menu has been posted for this meal. Try another date or dining hall.</p></div>}
      </section>}
    </>
  );
}
