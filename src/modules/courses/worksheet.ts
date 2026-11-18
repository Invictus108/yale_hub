/**
 * Saved sections for one student. Lives in data/courses/, which Aiden owns.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { courseByCrn, currentSeasonCode, meetsToday, type CourseSection } from "./catalog.js";

export interface SavedSection {
  seasonCode: string;
  seasonLabel: string;
  crn: number;
  courseCode: string;
  section: string;
  title: string;
  instructors: string[];
  meetings: CourseSection["meetings"];
  finalExam: string | null;
}

interface WorksheetFile {
  sections: SavedSection[];
}

function fileFor(netId: string): string {
  const id = netId.trim().toLowerCase();
  if (!/^[a-z][a-z0-9]{1,7}$/.test(id)) throw new Error("Invalid NetID.");
  return path.resolve(process.cwd(), "data", "courses", `${id}.json`);
}

async function readWorksheet(netId: string): Promise<SavedSection[]> {
  try {
    const parsed = JSON.parse(await readFile(fileFor(netId), "utf8")) as WorksheetFile;
    return parsed.sections ?? [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function writeWorksheet(netId: string, sections: SavedSection[]): Promise<void> {
  const file = fileFor(netId);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ sections }, null, 2), "utf8");
}

export async function listSavedCourses(netId: string): Promise<SavedSection[]> {
  return readWorksheet(netId);
}

export async function saveCourse(netId: string, crn: number, seasonCode = currentSeasonCode()): Promise<SavedSection> {
  const sections = await readWorksheet(netId);
  const existing = sections.find((section) => section.crn === crn && section.seasonCode === seasonCode);
  if (existing) return existing;
  const found = await courseByCrn(crn, seasonCode);
  const saved: SavedSection = {
    seasonCode: found.seasonCode,
    seasonLabel: found.seasonLabel,
    crn: found.crn,
    courseCode: found.courseCode,
    section: found.section,
    title: found.title,
    instructors: found.instructors,
    meetings: found.meetings,
    finalExam: found.finalExam,
  };
  sections.push(saved);
  await writeWorksheet(netId, sections);
  return saved;
}

export async function removeCourse(netId: string, crn: number, seasonCode?: string): Promise<boolean> {
  const sections = await readWorksheet(netId);
  const next = sections.filter((section) => section.crn !== crn || (seasonCode && section.seasonCode !== seasonCode));
  if (next.length === sections.length) return false;
  await writeWorksheet(netId, next);
  return true;
}

export function todaySections(sections: SavedSection[], seasonCode = currentSeasonCode()): SavedSection[] {
  return sections.filter((section) => section.seasonCode === seasonCode && meetsToday(section));
}
