import { SignInGate } from "../../components/gate";
import { Icon } from "../../components/icon";
import { currentNetId } from "../../lib/session";
import { formatCanvasWhen, listCanvasCourses, listCanvasTodo, type CanvasCourse, type CanvasTodo } from "../../../src/integrations/canvas";

/** Read-only Canvas. Credentials stay on the server. */
export default async function CanvasPage() {
  const netId = await currentNetId();
  if (!netId) return <SignInGate title="Your coursework, connected." detail="Sign in to see your active courses and keep your next deadline in sight." />;
  let courses: CanvasCourse[] = [];
  let todo: CanvasTodo[] = [];
  let error = "";
  try {
    [courses, todo] = await Promise.all([listCanvasCourses(), listCanvasTodo()]);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }
  return <>
    <header className="page-head"><p className="eyebrow">Canvas</p><h1>Stay a step ahead.</h1><p className="lede">Your active courses and upcoming work, brought together from Yale Canvas.</p></header>
    {error ? <section className="panel connection-empty"><span className="icon-box orange"><Icon name="canvas" size={24} /></span><h2>Let’s get Canvas connected.</h2><p className="muted">Your coursework will appear here when the Canvas connection is ready.</p><details className="sources"><summary>Connection details</summary><p>{error}</p></details><a className="button secondary" href="https://canvas.yale.edu" target="_blank" rel="noopener noreferrer">Open Yale Canvas <Icon name="arrow" size={16} /></a></section> : <div className="split">
      <section className="stack"><div className="section-heading"><h2>Your courses</h2><span>{courses.length} active</span></div>{courses.length ? courses.map((course) => <article className="panel canvas-course" key={course.id}><span className="pill">{course.courseCode || "Course"}</span><h3>{course.name}</h3><div className="course-meta"><span>{course.term || "Current term"}</span>{course.score && <span>Current grade · {course.score}</span>}</div></article>) : <div className="empty"><p className="muted">No active courses to show just yet.</p></div>}</section>
      <section className="panel"><div className="section-heading"><h2>On your to-do list</h2><span>{todo.length} items</span></div>{todo.length ? <ul className="canvas-todo">{todo.map((item, index) => <li key={index}><span className="todo-marker" /><div><span className="eyebrow">{item.courseName || item.type}</span><h3>{item.title}</h3><p>{formatCanvasWhen(item.dueAt)}</p></div></li>)}</ul> : <div className="empty"><Icon name="check" size={26} /><h3>You’re all caught up.</h3><p className="muted">There’s nothing on your Canvas to-do list.</p></div>}</section>
    </div>}
  </>;
}
