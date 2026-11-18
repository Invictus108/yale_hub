import Link from "next/link";
import { Icon } from "./icon";

export function SignInGate({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="gate">
      <section className="gate-card">
        <span className="chat-emblem"><Icon name="spark" size={27} /></span>
        <p className="eyebrow">Your campus, connected</p>
        <h1>{title}</h1>
        <p className="lede">{detail}</p>
        <p><Link className="button" href="/login">Sign in with NetID <Icon name="arrow" size={17} /></Link></p>
      </section>
    </div>
  );
}
