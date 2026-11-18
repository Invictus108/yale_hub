import { SignInGate } from "../../components/gate";
import { currentNetId } from "../../lib/session";
import { formatYalies, lookupYalies } from "../../../src/integrations/yalies";
import { formatMeetings, searchCourses, seasonLabel } from "../../../src/modules/courses/catalog";
import { listSavedCourses } from "../../../src/modules/courses/worksheet";
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
    return <SignInGate title="Courses" detail="Sign in to search the catalog and look people up." />;
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
      <header className="page-head">
        <p className="eyebrow">Courses</p>
        <h1>Follow your curiosity.</h1>
        <p className="lede">Explore the CourseTable catalog and make room for your next favorite class. Add a term to search beyond this semester.</p>
      </header>
      <div className="stack">
        <form className="panel" method="get">
          <label>
            Find a course
            <input name="q" defaultValue={query.q ?? ""} placeholder="CPSC 223, directed studies, Glenn" />
          </label>
          <button type="submit">Search</button>
        </form>
        {searchError ? <p className="banner">{searchError}</p> : null}
        {results ? (
          <section className="stack">
            <h2>{results.sections.length ? seasonLabel(results.seasonCode) : "No matches"}</h2>
            {results.sections.map((section) => (
              <article key={`${section.seasonCode}-${section.crn}`} className="panel course-result">
                <div className="section-heading"><span className="pill">{section.courseCode} · Section {section.section}</span><span>{section.credits === null ? "" : `${section.credits} credits`}</span></div>
                <h2>{section.title}</h2><p className="muted">{section.instructors.join(", ") || "Instructor to be announced"}</p>
                <p className="course-description">{section.description}</p>
                <div className="course-meta"><span>{formatMeetings(section.meetings)}</span><span>CRN {section.crn}</span></div>
                {section.finalExam && <p className="fine">Final exam: {section.finalExam}</p>}
                <div className="course-save"><SaveCourseButton crn={section.crn} seasonCode={section.seasonCode} /></div>
              </article>
            ))}
          </section>
        ) : null}
        <section className="panel">
          <h2>Your course worksheet</h2>
          {saved.length === 0 ? <p className="muted">Your next semester starts here. Search the catalog and save the classes that catch your eye.</p> : null}
          {saved.length ? (
            <ul className="memory">
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
        </section>
        <form className="panel" method="get">
          <h2>Find your people</h2>
          <label>
            Name or NetID
            <input name="person" defaultValue={query.person ?? ""} />
          </label>
          <button type="submit">Look up</button>
        </form>
        {peopleError ? <p className="banner">{peopleError}</p> : null}
        {people ? <pre className="brief">{people}</pre> : null}
      </div>
    </>
  );
}
