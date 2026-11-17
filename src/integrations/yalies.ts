/**
 * Aiden owns the Yalies directory client. Course tools call this for people lookup.
 * API keys belong in the environment, not in the student profile.
 */

export interface YaliesPerson {
  netId: string | null;
  name: string;
  college: string | null;
  year: number | null;
  email: string | null;
}

export async function lookupYalies(_query: string): Promise<YaliesPerson[]> {
  throw new Error("TODO(aiden): query the Yalies API.");
}
