import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { PreferenceNamespace, Profile, ProfilePreferences } from "../types";

const NAMESPACES: PreferenceNamespace[] = ["dining", "calendar", "courses", "briefs"];

const locks = new Map<string, Promise<void>>();

function dataDir(): string {
  return path.resolve(process.cwd(), "data", "profiles");
}

function fileFor(netId: string): string {
  return path.join(dataDir(), `${netId}.json`);
}

/** Yale NetIDs are 2–8 characters, starting with a letter. */
export function assertNetId(raw: string): string {
  const netId = raw.trim().toLowerCase();
  if (!/^[a-z][a-z0-9]{1,7}$/.test(netId)) {
    throw new Error("NetID must be 2–8 characters, start with a letter, and use only letters and digits.");
  }
  return netId;
}

export function emptyProfile(netId: string): Profile {
  return {
    netId,
    displayName: netId,
    email: `${netId}@yale.edu`,
    college: null,
    classYear: null,
    major: null,
    pronouns: null,
    timezone: "America/New_York",
    preferences: { dining: {}, calendar: {}, courses: {}, briefs: {} },
    notes: [],
    updatedAt: new Date().toISOString(),
  };
}

async function withLock<T>(netId: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(netId) ?? Promise.resolve();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => gate);
  locks.set(netId, tail);
  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(netId) === tail) locks.delete(netId);
  }
}

export async function loadProfile(netId: string): Promise<Profile | null> {
  const id = assertNetId(netId);
  try {
    const raw = await readFile(fileFor(id), "utf8");
    return JSON.parse(raw) as Profile;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function loadOrCreateProfile(netId: string): Promise<Profile> {
  const id = assertNetId(netId);
  return withLock(id, async () => {
    const existing = await loadProfile(id);
    if (existing) return existing;
    const created = emptyProfile(id);
    await saveProfile(created);
    return created;
  });
}

export async function saveProfile(profile: Profile): Promise<void> {
  const id = assertNetId(profile.netId);
  await mkdir(dataDir(), { recursive: true });
  const next = { ...profile, netId: id, updatedAt: new Date().toISOString() };
  await writeFile(fileFor(id), JSON.stringify(next, null, 2), "utf8");
}

export interface ProfilePatch {
  displayName?: string;
  college?: string | null;
  classYear?: number | null;
  major?: string | null;
  pronouns?: string | null;
  note?: string;
  preferences?: Partial<ProfilePreferences>;
}

export async function patchProfile(netId: string, patch: ProfilePatch): Promise<Profile> {
  const id = assertNetId(netId);
  return withLock(id, async () => {
    const current = (await loadProfile(id)) ?? emptyProfile(id);
    const preferences: ProfilePreferences = {
      dining: { ...current.preferences.dining },
      calendar: { ...current.preferences.calendar },
      courses: { ...current.preferences.courses },
      briefs: { ...current.preferences.briefs },
    };
    if (patch.preferences) {
      for (const namespace of NAMESPACES) {
        const incoming = patch.preferences[namespace];
        if (incoming && typeof incoming === "object") {
          preferences[namespace] = { ...preferences[namespace], ...incoming };
        }
      }
    }
    const notes = patch.note?.trim()
      ? [...current.notes, patch.note.trim()].slice(-50)
      : current.notes;
    const next: Profile = {
      ...current,
      displayName: patch.displayName?.trim() || current.displayName,
      college: patch.college === undefined ? current.college : patch.college,
      classYear: patch.classYear === undefined ? current.classYear : patch.classYear,
      major: patch.major === undefined ? current.major : patch.major,
      pronouns: patch.pronouns === undefined ? current.pronouns : patch.pronouns,
      preferences,
      notes,
      updatedAt: new Date().toISOString(),
    };
    await mkdir(dataDir(), { recursive: true });
    await writeFile(fileFor(id), JSON.stringify(next, null, 2), "utf8");
    return next;
  });
}
