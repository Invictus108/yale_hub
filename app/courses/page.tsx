import Link from "next/link";

import { currentNetId } from "../lib/session";
import { formatYalies, lookupYalies } from "../../src/integrations/yalies";
import { formatMeetings, formatSection, searchCourses, seasonLabel } from "../../src/modules/courses/catalog";
import { listSavedCourses } from "../../src/modules/courses/worksheet";
import { RemoveCourseButton, SaveCourseButton } from "./course-actions";

/** Aiden owns this page. */
export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; person?: string }>;
}) {
  const netId = await currentNetId();
  const query = await searchParams;
  if (!netId) {
    return (
      <>
        <h1>Courses</h1>
        <p><Link href="/login">Sign in</Link> to search the catalog.</p>
      </>
    );
  }
  const saved = await listSavedCourses(netId);
  let results: Awaited<ReturnType<typeof searchCourses>> | null = null;
  let searchError = "";
  if (query.q?.trim()) {
    try {
      results = await searchCourses(query.q);
    } catch (err) {
      searchError = err instanceof Error ? err.message : String(err);
    }
  }
  let people = "";
  let peopleError = "";
  if (query.person?.trim()) {
    try {
      people = formatYalies(await lookupYalies(query.person));
    } catch (err) {
      peopleError = err instanceof Error ? err.message : String(err);
    }
  }
  return (
    <>
      <h1>Courses</h1>
      <p>Search uses the CourseTable catalog for the current term unless the query names another one, such as spring 2026.</p>
      <form method="get">
        <label>
          Catalog
          <input name="q" defaultValue={query.q ?? ""} placeholder="CPSC 223, directed studies, Glenn" />
        </label>
        <button type="submit">Search</button>
      </form>
      {searchError ? <p>{searchError}</p> : null}
      {results ? (
        <>
          <h2>{results.sections.length ? seasonLabel(results.seasonCode) : "No matches"}</h2>
          {results.sections.map((section) => (
            <article key={`${section.seasonCode}-${section.crn}`}>
              <pre>{formatSection(section)}</pre>
              <SaveCourseButton crn={section.crn} seasonCode={section.seasonCode} />
            </article>
          ))}
        </>
      ) : null}
      <h2>Worksheet</h2>
      {saved.length === 0 ? <p>No saved sections yet.</p> : null}
      {saved.length ? (
        <ul>
          {saved.map((section) => (
            <li key={`${section.seasonCode}-${section.crn}`}>
              {section.courseCode} section {section.section} — {section.title} ({section.seasonLabel})
              <br />
              {formatMeetings(section.meetings)}{" "}
              <RemoveCourseButton crn={section.crn} seasonCode={section.seasonCode} />
            </li>
          ))}
        </ul>
      ) : null}
      <h2>Yalies</h2>
      <form method="get">
        <label>
          Name or NetID
          <input name="person" defaultValue={query.person ?? ""} />
        </label>
        <button type="submit">Look up</button>
      </form>
      {peopleError ? <p>{peopleError}</p> : null}
      {people ? <pre>{people}</pre> : null}
    </>
  );
}
