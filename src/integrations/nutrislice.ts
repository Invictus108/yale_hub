/**
 * Aiden owns Nutrislice. Dining tools should call this.
 * Module-local cache belongs in data/dining/.
 */

export interface MenuItem {
  name: string;
  station: string | null;
}

export interface DiningMenu {
  hall: string;
  date: string;
  meal: "breakfast" | "lunch" | "dinner";
  items: MenuItem[];
}

export async function getDiningMenu(
  _hall: string,
  _date: string,
  _meal: DiningMenu["meal"],
): Promise<DiningMenu> {
  throw new Error("TODO(aiden): fetch this hall's menu from Nutrislice.");
}
