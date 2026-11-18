/** Render the brief's plain Markdown headings without injecting HTML. */
export function BriefDocument({ text }: { text: string }) {
  const sections = text.trim().split(/^## /m);
  const intro = (sections.shift() || "").trim().split("\n");
  return <article className="brief-document">
    <header><p className="eyebrow">YALEHUB · THE MORNING BRIEF</p><h2>A new day at Yale.</h2><p>{intro.filter((line) => line && !line.startsWith("#")).join(" ")}</p></header>
    {sections.map((section, index) => { const [title, ...body] = section.split("\n"); return <section key={index}><h3><span>{String(index + 1).padStart(2, "0")}</span>{title}</h3><div>{body.join("\n").trim().split(/\n\s*\n/).map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div></section>; })}
    <footer>A little more prepared. A little more present.</footer>
  </article>;
}
