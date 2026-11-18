import { SignInGate } from "../../components/gate";
import { currentNetId } from "../../lib/session";
import { ChatForm } from "./chat-form";

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const netId = await currentNetId();
  const query = await searchParams;
  if (!netId) {
    return <SignInGate title="Chat" detail="Sign in so the hub can load your profile before it answers." />;
  }
  return (
    <>
      <header className="page-head">
        <p className="eyebrow">Your assistant</p>
        <h1>A good place to start.</h1>
        <p className="lede">A hand with your day. An answer to your questions. A little less to keep in your head.</p>
      </header>
      <ChatForm key={query.q || "new"} initialQuestion={typeof query.q === "string" ? query.q.slice(0, 2000) : ""} />
    </>
  );
}
