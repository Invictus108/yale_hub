/**
 * Aiden owns course search. Results come from the public CourseTable catalog,
 * which mirrors courses.yale.edu. The official search POST sits behind a bot check.
 */

const GRAPHQL = "https://api.coursetable.com/ferry/v1/graphql";

export interface CourseMeeting {
  days: number;
  start: string;
  end: string;
}

export interface CourseSection {
  seasonCode: string;
  seasonLabel: string;
  crn: number;
  courseCode: string;
  section: string;
  title: string;
  credits: number | null;
  instructors: string[];
  meetings: CourseMeeting[];
  description: string;
  finalExam: string | null;
}

const DAY_LABELS: Array<[number, string]> = [
  [1, "Sun"],
  [2, "Mon"],
  [4, "Tue"],
  [8, "Wed"],
  [16, "Thu"],
  [32, "Fri"],
  [64, "Sat"],
];

export function newYorkToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
}

export function newYorkWeekdayBit(now = new Date()): number {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(now);
  const found = DAY_LABELS.find(([, label]) => label === name);
  return found?.[0] ?? 0;
}

/** Fall is YYYY03, spring YYYY01, summer YYYY02, matching courses.yale.edu srcdb. */
export function currentSeasonCode(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  if (month <= 5) return `${year}01`;
  if (month <= 7) return `${year}02`;
  return `${year}03`;
}

export function seasonLabel(code: string): string {
  const year = code.slice(0, 4);
  const term = code.slice(4);
  const name = term === "01" ? "Spring" : term === "02" ? "Summer" : term === "03" ? "Fall" : "Term";
  return `${name} ${year}`;
}

export function decodeDays(bits: number): string {
  const names = DAY_LABELS.filter(([bit]) => (bits & bit) !== 0).map(([, label]) => label);
  return names.join("/") || "unscheduled";
}

export function formatClock(hhmm: string): string {
  const [hourText, minuteText] = hhmm.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour)) return hhmm;
  const suffix = hour >= 12 ? "PM" : "AM";
  const twelve = hour % 12 || 12;
  if (!minute) return `${twelve} ${suffix}`;
  return `${twelve}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function formatMeetings(meetings: CourseMeeting[]): string {
  if (!meetings.length) return "Times not listed";
  return meetings
    .map((meeting) => `${decodeDays(meeting.days)} ${formatClock(meeting.start)}–${formatClock(meeting.end)}`)
    .join("; ");
}

export function parseSeasonQuery(raw: string): { seasonCode: string; text: string } {
  let text = raw.trim();
  let seasonCode = currentSeasonCode();
  const coded = /\b(20\d{2}0[123])\b/.exec(text);
  if (coded?.[1]) {
    seasonCode = coded[1];
    text = text.replace(coded[1], " ");
  }
  const named = /\b(fall|spring|summer)\s+(20\d{2})\b/i.exec(text);
  if (named?.[1] && named[2]) {
    const term = named[1].toLowerCase();
    const suffix = term === "spring" ? "01" : term === "summer" ? "02" : "03";
    seasonCode = `${named[2]}${suffix}`;
    text = text.replace(named[0], " ");
  }
  return { seasonCode, text: text.replace(/\s+/g, " ").trim() };
}

interface ListingRow {
  course_code: string;
  crn: number;
  section: string;
  season_code: string;
  course: {
    title: string;
    description?: string | null;
    credits?: number | null;
    final_exam?: string | null;
    course_professors?: Array<{ professor?: { name?: string | null } | null }>;
    course_meetings?: Array<{ days_of_week?: number | null; start_time?: string | null; end_time?: string | null }>;
  };
}

const SEARCH = `
query Search($season: String!, $pattern: String!) {
  listings(
    limit: 12
    order_by: [{ course_code: asc }, { section: asc }]
    where: {
      season_code: { _eq: $season }
      _or: [
        { course_code: { _ilike: $pattern } }
        { subject: { _ilike: $pattern } }
        { course: { title: { _ilike: $pattern } } }
        { course: { course_professors: { professor: { name: { _ilike: $pattern } } } } }
      ]
    }
  ) {
    course_code
    crn
    section
    season_code
    course {
      title
      description
      credits
      final_exam
      course_professors { professor { name } }
      course_meetings { days_of_week start_time end_time }
    }
  }
}`;

const BY_CRN = `
query ByCrn($season: String!, $crn: Int!) {
  listings(limit: 1, where: { season_code: { _eq: $season }, crn: { _eq: $crn } }) {
    course_code
    crn
    section
    season_code
    course {
      title
      description
      credits
      final_exam
      course_professors { professor { name } }
      course_meetings { days_of_week start_time end_time }
    }
  }
}`;

function toSection(row: ListingRow): CourseSection {
  const instructors = (row.course.course_professors ?? [])
    .map((entry) => entry.professor?.name?.trim() || "")
    .filter(Boolean);
  const meetings = (row.course.course_meetings ?? [])
    .filter((meeting) => meeting.start_time && meeting.end_time)
    .map((meeting) => ({
      days: meeting.days_of_week ?? 0,
      start: meeting.start_time ?? "",
      end: meeting.end_time ?? "",
    }));
  const finalExam = row.course.final_exam?.trim() || null;
  return {
    seasonCode: row.season_code,
    seasonLabel: seasonLabel(row.season_code),
    crn: row.crn,
    courseCode: row.course_code,
    section: row.section,
    title: row.course.title,
    credits: typeof row.course.credits === "number" ? row.course.credits : null,
    instructors,
    meetings,
    description: (row.course.description ?? "").replace(/\s+/g, " ").trim(),
    finalExam: finalExam && !/^no (regular )?final/i.test(finalExam) ? finalExam : null,
  };
}

async function query<T>(document: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(GRAPHQL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query: document, variables }),
  });
  const payload = (await response.json()) as { data?: T; errors?: Array<{ message?: string }> };
  if (!response.ok || payload.errors?.length) {
    throw new Error(payload.errors?.[0]?.message || `Course catalog returned ${response.status}.`);
  }
  if (!payload.data) throw new Error("Course catalog returned an empty response.");
  return payload.data;
}

export async function searchCourses(rawQuery: string): Promise<{ seasonCode: string; sections: CourseSection[] }> {
  const { seasonCode, text } = parseSeasonQuery(rawQuery);
  if (!text) throw new Error("Say a subject, title, instructor, or course code to search.");
  const pattern = `%${text.replace(/[%_]/g, " ")}%`;
  const data = await query<{ listings: ListingRow[] }>(SEARCH, { season: seasonCode, pattern });
  const seen = new Set<number>();
  const sections: CourseSection[] = [];
  for (const row of data.listings) {
    if (seen.has(row.crn)) continue;
    seen.add(row.crn);
    sections.push(toSection(row));
  }
  return { seasonCode, sections };
}

export async function courseByCrn(crn: number, seasonCode = currentSeasonCode()): Promise<CourseSection> {
  if (!Number.isInteger(crn)) throw new Error("CRN must be a whole number.");
  const data = await query<{ listings: ListingRow[] }>(BY_CRN, { season: seasonCode, crn });
  const row = data.listings[0];
  if (!row) throw new Error(`No ${seasonLabel(seasonCode)} section with CRN ${crn}.`);
  return toSection(row);
}

export function formatSection(section: CourseSection): string {
  const who = section.instructors.length ? section.instructors.join(", ") : "Instructor not listed";
  const credits = section.credits === null ? "" : `\n${section.credits} credit${section.credits === 1 ? "" : "s"}`;
  const blurb = section.description ? `\n${section.description.slice(0, 280)}` : "";
  const finalExam = section.finalExam ? `\nFinal: ${section.finalExam}` : "";
  return `${section.courseCode} section ${section.section} (CRN ${section.crn}) — ${section.title} [${section.seasonLabel}]\n${who}\n${formatMeetings(section.meetings)}${credits}${finalExam}${blurb}`;
}

export function meetsToday(section: { meetings: CourseMeeting[] }, bit = newYorkWeekdayBit()): boolean {
  return section.meetings.some((meeting) => (meeting.days & bit) !== 0);
}
