import { redirect } from "next/navigation";
import { currentNetId } from "../../lib/session";
import { loadOrCreateProfile } from "../../../src/core/memory/profile";
import { ChatError, listChats, readChat } from "../../../src/core/memory/chat-store";
import { readCampus } from "../../../src/core/memory/campus";
import { ChatForm } from "./chat-form";
import "./chat.css";

export default async function ChatPage({ searchParams }: { searchParams: Promise<{ q?: string; id?: string }> }) {
  const netId = await currentNetId();
  if (!netId) redirect("/login");
  const query = await searchParams;
  const [profile, chats, snapshot] = await Promise.all([loadOrCreateProfile(netId), listChats(netId), readCampus(netId)]);
  let chat = null;
  let error = "";
  if (query.id) {
    try { chat = await readChat(netId, query.id); }
    catch (err) { if (err instanceof ChatError) error = err.message; else throw err; }
  }
  return <ChatForm key={netId} netId={netId} name={profile.displayName} initialChats={chats} initialChat={chat} initialSnapshot={snapshot} initialError={error} initialQuestion={typeof query.q === "string" ? query.q.slice(0, 2000) : ""} />;
}
