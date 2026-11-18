/**
 * Aiden owns the Yalies directory client. Course tools call this for people lookup.
 * The API key belongs in YALIES_API_KEY, not in the student profile.
 */

export interface YaliesPerson {
  netId: string | null;
  name: string;
  college: string | null;
  year: number | null;
  email: string | null;
}

interface YaliesRecord {
  netid?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  preferred_name?: string | null;
  college?: string | null;
  year?: number | null;
  email?: string | null;
}

export async function lookupYalies(query: string): Promise<YaliesPerson[]> {
  const text = query.trim();
  if (!text) throw new Error("Say who to look up.");
  const key = process.env.YALIES_API_KEY?.trim();
  if (!key) {
    throw new Error("Set YALIES_API_KEY to look people up. Create a key at https://yalies.io/api.");
  }
  const response = await fetch("https://api.yalies.io/v2/people", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ query: text, page: 0, page_size: 8 }),
  });
  const payload = (await response.json()) as YaliesRecord[] | { error?: string; message?: string };
  if (!response.ok || !Array.isArray(payload)) {
    const message = !Array.isArray(payload) ? payload.error || payload.message : "";
    throw new Error(message || `Yalies returned ${response.status}.`);
  }
  return payload.map((person) => {
    const preferred = person.preferred_name?.trim();
    const full = [person.first_name, person.last_name].filter(Boolean).join(" ").trim();
    return {
      netId: person.netid?.trim() || null,
      name: preferred || full || person.netid || "Unknown",
      college: person.college?.trim() || null,
      year: typeof person.year === "number" ? person.year : null,
      email: person.email?.trim() || null,
    };
  });
}

export function formatYalies(people: YaliesPerson[]): string {
  if (!people.length) return "No Yalies matches.";
  return people
    .map((person) => {
      const bits = [
        person.name,
        person.netId ? `(${person.netId})` : "",
        person.college,
        person.year ? `’${String(person.year).slice(-2)}` : "",
        person.email,
      ].filter(Boolean);
      return bits.join(" · ");
    })
    .join("\n");
}
