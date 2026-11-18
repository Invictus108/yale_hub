/**
 * Read-only Yale Canvas client.
 * Token stays in CANVAS_API_TOKEN. Do not put it on the student profile.
 * The Canvas module registers the tools that call this client.
 */

const TIME_ZONE = "America/New_York";
const DEFAULT_BASE = "https://canvas.yale.edu";
const MAX_PAGES = 4;

export interface CanvasCourse {
  id: number;
  name: string;
  courseCode: string;
  term: string | null;
  score: string | null;
}

export interface CanvasAssignment {
  id: number;
  courseId: number;
  courseName: string | null;
  name: string;
  dueAt: string | null;
  pointsPossible: number | null;
  htmlUrl: string | null;
  submitted: boolean;
}

export interface CanvasTodo {
  type: string;
  courseName: string | null;
  title: string;
  dueAt: string | null;
  htmlUrl: string | null;
}

export interface CanvasAnnouncement {
  id: number;
  courseName: string | null;
  title: string;
  postedAt: string | null;
  htmlUrl: string | null;
  message: string;
}

function baseUrl(): string {
  return (process.env.CANVAS_BASE_URL?.trim() || DEFAULT_BASE).replace(/\/$/, "");
}

function token(): string {
  const value = process.env.CANVAS_API_TOKEN?.trim();
  if (!value) {
    throw new Error("Set CANVAS_API_TOKEN. In Canvas open Account, Settings, then New Access Token.");
  }
  return value;
}

function canvasError(status: number, body: string): string {
  if (status === 401) return "Canvas rejected CANVAS_API_TOKEN. Create a new access token and try again.";
  const snippet = body.replace(/\s+/g, " ").slice(0, 180);
  return snippet ? `Canvas returned ${status}: ${snippet}` : `Canvas returned ${status}.`;
}

function nextUrl(link: string | null): string | null {
  if (!link) return null;
  for (const part of link.split(",")) {
    const match = /<([^>]+)>;\s*rel="next"/.exec(part);
    if (match?.[1]) return match[1];
  }
  return null;
}

async function canvasGetAll(path: string, search: URLSearchParams): Promise<unknown[]> {
  const items: unknown[] = [];
  let url: string | null = `${baseUrl()}${path}?${search.toString()}`;
  for (let page = 0; page < MAX_PAGES && url; page += 1) {
    const response = await fetch(url, {
      headers: { authorization: `Bearer ${token()}`, accept: "application/json" },
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(canvasError(response.status, raw));
    const payload = raw ? (JSON.parse(raw) as unknown) : [];
    if (Array.isArray(payload)) items.push(...payload);
    url = nextUrl(response.headers.get("link"));
  }
  return items;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function plain(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatCanvasWhen(iso: string | null): string {
  if (!iso) return "no due date";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export async function listCanvasCourses(): Promise<CanvasCourse[]> {
  const search = new URLSearchParams();
  search.append("enrollment_state", "active");
  search.append("per_page", "50");
  search.append("include[]", "term");
  search.append("include[]", "total_scores");
  const rows = await canvasGetAll("/api/v1/courses", search);
  const courses: CanvasCourse[] = [];
  for (const row of rows) {
    const course = asRecord(row);
    if (!course || typeof course.id !== "number") continue;
    if (course.access_restricted_by_date === true) continue;
    const enrollments = Array.isArray(course.enrollments) ? course.enrollments : [];
    const enrollment = asRecord(enrollments[0]);
    const grade = text(enrollment?.computed_current_grade);
    const score = num(enrollment?.computed_current_score);
    const term = asRecord(course.term);
    courses.push({
      id: course.id,
      name: text(course.name) ?? `Course ${course.id}`,
      courseCode: text(course.course_code) ?? "",
      term: text(term?.name),
      score: grade ?? (score === null ? null : `${score}%`),
    });
  }
  return courses.sort((a, b) => a.courseCode.localeCompare(b.courseCode) || a.name.localeCompare(b.name));
}

export function findCanvasCourses(courses: CanvasCourse[], query: string): CanvasCourse[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return courses;
  return courses.filter((course) => {
    return (
      String(course.id) === needle ||
      course.courseCode.toLowerCase().includes(needle) ||
      course.name.toLowerCase().includes(needle)
    );
  });
}

export async function listCanvasAssignments(course: CanvasCourse): Promise<CanvasAssignment[]> {
  const search = new URLSearchParams();
  search.append("per_page", "50");
  search.append("order_by", "due_at");
  search.append("bucket", "upcoming");
  search.append("include[]", "submission");
  const rows = await canvasGetAll(`/api/v1/courses/${course.id}/assignments`, search);
  const assignments: CanvasAssignment[] = [];
  for (const row of rows) {
    const item = asRecord(row);
    if (!item || typeof item.id !== "number") continue;
    const submission = asRecord(item.submission);
    assignments.push({
      id: item.id,
      courseId: course.id,
      courseName: course.name,
      name: text(item.name) ?? `Assignment ${item.id}`,
      dueAt: text(item.due_at),
      pointsPossible: num(item.points_possible),
      htmlUrl: text(item.html_url),
      submitted: Boolean(text(submission?.submitted_at)),
    });
  }
  return assignments;
}

export async function listCanvasTodo(): Promise<CanvasTodo[]> {
  const search = new URLSearchParams();
  search.append("per_page", "40");
  const rows = await canvasGetAll("/api/v1/users/self/todo", search);
  const items: CanvasTodo[] = [];
  for (const row of rows) {
    const item = asRecord(row);
    if (!item) continue;
    const assignment = asRecord(item.assignment);
    const quiz = asRecord(item.quiz);
    const source = assignment ?? quiz;
    items.push({
      type: text(item.type) ?? "todo",
      courseName: text(item.context_name),
      title: text(source?.name) ?? text(item.context_name) ?? "Canvas to-do",
      dueAt: text(source?.due_at) ?? text(assignment?.due_at),
      htmlUrl: text(item.html_url) ?? text(source?.html_url),
    });
  }
  return items;
}

export async function listCanvasAnnouncements(courses: CanvasCourse[]): Promise<CanvasAnnouncement[]> {
  if (!courses.length) return [];
  const search = new URLSearchParams();
  search.append("per_page", "20");
  search.append("latest_only", "true");
  for (const course of courses) search.append("context_codes[]", `course_${course.id}`);
  const rows = await canvasGetAll("/api/v1/announcements", search);
  const byId = new Map(courses.map((course) => [course.id, course.name]));
  const announcements: CanvasAnnouncement[] = [];
  for (const row of rows) {
    const item = asRecord(row);
    if (!item || typeof item.id !== "number") continue;
    const context = text(item.context_code);
    const courseId = context?.startsWith("course_") ? Number(context.slice("course_".length)) : null;
    announcements.push({
      id: item.id,
      courseName: courseId && byId.has(courseId) ? (byId.get(courseId) ?? null) : null,
      title: text(item.title) ?? "Announcement",
      postedAt: text(item.posted_at),
      htmlUrl: text(item.html_url),
      message: plain(text(item.message) ?? "").slice(0, 280),
    });
  }
  return announcements.sort((a, b) => (b.postedAt ?? "").localeCompare(a.postedAt ?? ""));
}

export function formatCanvasCourses(courses: CanvasCourse[]): string {
  if (!courses.length) return "No active Canvas courses.";
  return courses
    .map((course) => {
      const code = course.courseCode ? `${course.courseCode} — ` : "";
      const term = course.term ? ` [${course.term}]` : "";
      const score = course.score ? ` · ${course.score}` : "";
      return `${code}${course.name}${term}${score} (id ${course.id})`;
    })
    .join("\n");
}

export function formatCanvasAssignments(assignments: CanvasAssignment[]): string {
  if (!assignments.length) return "No upcoming Canvas assignments.";
  return assignments
    .map((item) => {
      const where = item.courseName ? `${item.courseName}: ` : "";
      const points = item.pointsPossible === null ? "" : ` · ${item.pointsPossible} pts`;
      const done = item.submitted ? " · submitted" : "";
      return `${where}${item.name} — ${formatCanvasWhen(item.dueAt)}${points}${done}`;
    })
    .join("\n");
}

export function formatCanvasTodo(items: CanvasTodo[]): string {
  if (!items.length) return "Canvas to-do list is empty.";
  return items
    .map((item) => {
      const where = item.courseName ? `${item.courseName}: ` : "";
      return `${where}${item.title} — ${formatCanvasWhen(item.dueAt)} (${item.type})`;
    })
    .join("\n");
}

export function formatCanvasAnnouncements(items: CanvasAnnouncement[]): string {
  if (!items.length) return "No recent Canvas announcements.";
  return items
    .map((item) => {
      const where = item.courseName ? `${item.courseName}: ` : "";
      const when = item.postedAt ? ` — ${formatCanvasWhen(item.postedAt)}` : "";
      const body = item.message ? `\n  ${item.message}` : "";
      return `${where}${item.title}${when}${body}`;
    })
    .join("\n\n");
}
