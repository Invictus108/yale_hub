import Link from "next/link";
import { currentNetId } from "../lib/session";
import { Icon, type IconName } from "../components/icon";
import { featureModules } from "../../src/core/mcp-server";
import { loadProfile } from "../../src/core/memory/profile";
import { recentEpisodes } from "../../src/core/memory/episodic";

const FEATURES: Record<string, { icon: IconName; text: string; action: string; tone: string }> = {
  calendar: { icon: "calendar", text: "Make room for what matters. Your classes, plans, and everything in between.", action: "Open calendar", tone: "blue" },
  courses: { icon: "courses", text: "Find your next great class and build a worksheet that feels like you.", action: "Explore courses", tone: "purple" },
  dining: { icon: "dining", text: "A good day starts with a good meal. See what’s on the menu around campus.", action: "Find a meal", tone: "orange" },
  canvas: { icon: "canvas", text: "Keep the next deadline in sight. Courses, assignments, and your to-do list.", action: "View coursework", tone: "green" },
  briefs: { icon: "briefs", text: "Your campus day, thoughtfully gathered into one morning read.", action: "Read your brief", tone: "blue" },
};

export default async function OverviewPage() {
  const netId = await currentNetId();
  const [profile, episodes] = netId ? await Promise.all([loadProfile(netId), recentEpisodes(netId, 3)]) : [null, []];
  const date = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long", month: "long", day: "numeric" }).format(new Date());
  const name = profile?.displayName?.split(" ")[0] || netId;
  const modules = [...featureModules].sort((a, b) => ["calendar", "courses", "dining", "canvas", "briefs"].indexOf(a.id) - ["calendar", "courses", "dining", "canvas", "briefs"].indexOf(b.id));
  return <>
    <header className="page-head overview-head"><div><p className="eyebrow">Your day, a little clearer</p><h1>{name ? `Welcome back, ${name}.` : "Your Yale. All together."}</h1><p className="lede">A home for your plans, your questions, and everything ahead.</p></div><span className="date-label"><Icon name="calendar" size={16} />{date}</span></header>
    <div className="dashboard-grid">
      <div className="dashboard-primary">
        <section className="assistant-hero">
          <div className="hero-orbit" aria-hidden="true"><span>Y</span></div>
          <div className="hero-content"><span className="hero-kicker"><Icon name="spark" size={16} /> YOUR PERSONAL CAMPUS ASSISTANT</span><h2>A full day.<br />A little more headspace.</h2><p>From “what’s for dinner?” to “what’s next?”<br />Start with a question. We’ll take it from there.</p>
          <form action="/chat" className="quick-ask"><label className="sr-only" htmlFor="quick-question">Ask your assistant</label><Icon name="spark" size={20} /><input id="quick-question" name="q" placeholder="What can I help you with?" required maxLength={2000} /><button aria-label="Continue to chat" type="submit"><Icon name="arrow" /></button></form>
          <div className="hero-prompts"><span>Try asking</span><Link href="/chat?q=What%20is%20on%20my%20calendar%20today%3F">Plan my day <Icon name="arrow" size={13} /></Link><Link href="/chat?q=What%20is%20for%20dinner%20today%3F">Find dinner <Icon name="arrow" size={13} /></Link></div></div>
        </section>
        <div className="section-heading"><h2>Your campus toolkit</h2><span>{modules.length} ways to stay connected</span></div>
        <section className="toolkit" aria-label="Campus tools">{modules.map((mod) => { const feature = FEATURES[mod.id]; return <Link href={`/${mod.id}`} className={`tool-card ${mod.id === "briefs" ? "tool-card-wide" : ""}`} key={mod.id}><span className={`icon-box ${feature?.tone || "blue"}`}><Icon name={feature?.icon || "spark"} size={22} /></span><div><h3>{mod.id === "briefs" ? "Morning brief" : mod.name}</h3><p>{feature?.text || `Explore ${mod.name.toLowerCase()} in your workspace.`}</p><span className="card-action">{feature?.action || "Explore"}<Icon name="arrow" size={15} /></span></div></Link>; })}</section>
      </div>
      <aside className="dashboard-rail" aria-label="Your workspace highlights">
        <section className="daily-card"><div className="section-heading"><span className="eyebrow">THE DAILY EDIT</span><Icon name="briefs" size={19} /></div><h2>Start with the<br />bigger picture.</h2><p>Your schedule, campus dining, and coursework. One brief to bring it all together.</p><Link href="/briefs" className="text-link">Open morning brief <Icon name="arrow" size={16} /></Link><div className="daily-rule" /><span className="small-note"><Icon name="clock" size={14} /> Made for your morning</span></section>
        <section className="profile-card"><div className="section-heading"><h2>Your corner of Yale</h2><Icon name="profile" size={18} /></div><span className="profile-avatar">{name ? name.slice(0, 1).toUpperCase() : "Y"}</span><h3>{profile?.displayName || netId || "Make yourself at home"}</h3><p>{profile?.college || "A workspace that gets to know you."}</p>{profile?.major && <span className="pill">{profile.major}</span>}<Link href={netId ? "/profile" : "/login"} className="button secondary">{netId ? "View your profile" : "Sign in with NetID"}<Icon name="arrow" size={16} /></Link></section>
        <section className="activity-card"><div className="section-heading"><h2>A little continuity</h2><span className="quiet-dot" /></div>{episodes.length ? <ul className="activity-list">{[...episodes].reverse().map((episode) => <li key={episode.id}><Icon name="chat" size={16} /><div><p>{episode.summary.replace(/^User: /, "").split(" | Hub:")[0]}</p><time dateTime={episode.at}>{new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" }).format(new Date(episode.at))}</time></div></li>)}</ul> : <p>Your conversations help the hub remember what matters to you. It starts with a hello.</p>}<Link href="/chat" className="text-link">{episodes.length ? "Continue a conversation" : "Start a conversation"}<Icon name="arrow" size={15} /></Link></section>
      </aside>
    </div>
  </>;
}
