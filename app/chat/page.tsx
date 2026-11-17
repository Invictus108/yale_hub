import Link from "next/link";

import { currentNetId } from "../lib/session.js";
import { ChatForm } from "./chat-form.js";

export default async function ChatPage() {
  const netId = await currentNetId();
  if (!netId) {
    return (
      <>
        <h1>Chat</h1>
        <p><Link href="/login">Sign in</Link> to talk to the hub.</p>
      </>
    );
  }
  return (
    <>
      <h1>Chat</h1>
      <p>Each question loads your profile and retrieves Yale chunks before the reply.</p>
      <ChatForm />
    </>
  );
}
