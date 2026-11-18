import Link from "next/link";
import { redirect } from "next/navigation";
import { casMode, loginRedirectUrl } from "../../src/core/auth";
import { currentNetId } from "../lib/session";
import { Icon } from "../components/icon";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentNetId()) redirect("/");
  const { error } = await searchParams;
  const mock = casMode() === "mock";
  return <main className="auth">
    <section className="auth-story">
      <Link href="/" className="brand" aria-label="YaleHub home"><span className="brand-mark">Y</span><span>Yale<span className="brand-light">Hub</span><small>YOUR CAMPUS, CONNECTED</small></span></Link>
      <div className="auth-story-content"><p className="eyebrow">A little less juggling.</p><h2>A full Yale life.<br /><em>One place<br />to begin.</em></h2><p>Your classes, your plans, your next big question. Bring it all together in a space that remembers you.</p></div>
      <small>NEW HAVEN, CONNECTICUT</small>
    </section>
    <div className="auth-content"><section className="auth-card">
      <p className="eyebrow">Welcome to your workspace</p><h1>Make yourself<br />at home.</h1>
      <p className="lede">Sign in with your NetID to find your plans, pick up a conversation, and get on with your day.</p>
      {error && <p className="banner" role="alert">{error}</p>}
      {mock ? <form method="post" action="/api/auth/login"><label>Yale NetID<input name="netId" autoComplete="username" placeholder="e.g. ab123" required /></label><p><button type="submit">Enter your workspace <Icon name="arrow" size={17} /></button></p></form> : <p><a className="button" href={loginRedirectUrl()}>Continue with NetID <Icon name="arrow" size={17} /></a></p>}
      <p className="fine">{mock ? "Local development sign-in. No Yale credentials required." : "You’ll continue to Yale’s test sign-in service to authenticate. Your password is never shared with YaleHub."}</p>
      <Link href="/" className="auth-back">Back to overview <Icon name="arrow" size={14} /></Link>
    </section></div>
  </main>;
}
