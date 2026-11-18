"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon, type IconName } from "../../components/icon";
import type { SavedChat, ChatSummary, CampusSnapshot } from "../../../src/core/memory/chat-types";

const SUGGESTIONS: { title: string; question: string; icon: IconName }[] = [
  { title: "Plan my day", question: "Use my calendar and Canvas assignments to help me plan today.", icon: "calendar" },
  { title: "Manage my calendar", question: "Help me add an event to my calendar.", icon: "clock" },
  { title: "Find a meal", question: "What is for dinner at my college?", icon: "dining" },
  { title: "Explore courses", question: "Help me find and save courses for next semester.", icon: "courses" },
];
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data as T;
}
function summary(chat: SavedChat): ChatSummary {
  const { messages, ...rest } = chat;
  return { ...rest, messageCount: messages.length };
}
function MessageText({ text }: { text: string }) {
  return <div className="chat-prose">{text.split("\n").map((line, index) => {
    if (!line.trim()) return <div className="paragraph-space" key={index} />;
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    const clean = heading ? heading[2] : line.replace(/^[-*]\s+/, "• ");
    const parts = clean.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part);
    return heading ? <h3 key={index}>{parts}</h3> : <p key={index}>{parts}</p>;
  })}</div>;
}

export function ChatForm({ netId, name, initialChats, initialChat, initialSnapshot, initialQuestion = "", initialError = "" }: {
  netId: string; name: string; initialChats: ChatSummary[]; initialChat: SavedChat | null;
  initialSnapshot: CampusSnapshot | null; initialQuestion?: string; initialError?: string;
}) {
  const [chats, setChats] = useState(initialChats);
  const [chat, setChat] = useState(initialChat);
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [draft, setDraft] = useState(initialQuestion);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(initialError);
  const [refreshError, setRefreshError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const selected = useRef(initialChat?.id || null);
  const selectionVersion = useRef(0);
  const request = useRef<{ id: string; chatId: string; text: string } | null>(null);
  const mounted = useRef(true);
  const scrollArea = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const refreshController = useRef<AbortController | null>(null);

  function remember(next: SavedChat) {
    setChats((current) => [summary(next), ...current.filter((item) => item.id !== next.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }
  function address(id: string | null) {
    window.history.pushState({}, "", id ? "/chat?id=" + encodeURIComponent(id) : "/chat");
  }
  async function openChat(id: string | null, updateUrl = true) {
    const version = ++selectionVersion.current;
    selected.current = id;
    setSidebarOpen(false);
    setError("");
    setDraft("");
    if (updateUrl) address(id);
    if (!id) { setChat(null); setLoading(false); return; }
    setLoading(true);
    try {
      const data = await api<{ chat: SavedChat }>("/api/chat/conversations/" + encodeURIComponent(id));
      if (version === selectionVersion.current && mounted.current) setChat(data.chat);
    } catch (err) {
      if (version === selectionVersion.current && mounted.current) { setChat(null); setError((err as Error).message); }
    } finally { if (version === selectionVersion.current && mounted.current) setLoading(false); }
  }
  async function newChat() {
    setLoading(true); setError("");
    try {
      const data = await api<{ chat: SavedChat }>("/api/chat/conversations", { method: "POST" });
      remember(data.chat); selected.current = data.chat.id; ++selectionVersion.current;
      setChat(data.chat); address(data.chat.id); setDraft(""); setSidebarOpen(false); input.current?.focus();
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }
  async function refresh(force = false) {
    refreshController.current?.abort();
    const controller = new AbortController();
    refreshController.current = controller;
    setRefreshing(true); setRefreshError("");
    const kickoff = Date.now();
    try {
      await api("/api/chat/refresh" + (force ? "?force=true" : ""), { method: "POST", signal: controller.signal });
      for (let attempt = 0; attempt < 50 && !controller.signal.aborted; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        if (controller.signal.aborted) return;
        const data = await api<{ snapshot: CampusSnapshot | null }>("/api/chat/refresh", { signal: controller.signal });
        if (data.snapshot && mounted.current) setSnapshot(data.snapshot);
        const completed = data.snapshot?.completedAt ? Date.parse(data.snapshot.completedAt) : 0;
        if (data.snapshot && !data.snapshot.refreshing && (completed >= kickoff || (!force && kickoff - completed < 15 * 60 * 1000))) return;
      }
      if (!controller.signal.aborted) setRefreshError("The refresh is taking longer than expected. You can keep chatting and try again.");
    } catch (err) {
      if (!controller.signal.aborted && mounted.current) setRefreshError((err as Error).message);
    } finally { if (!controller.signal.aborted && mounted.current) setRefreshing(false); }
  }
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const onBack = () => { void openChat(new URLSearchParams(window.location.search).get("id"), false); };
    window.addEventListener("popstate", onBack);
    return () => { mounted.current = false; refreshController.current?.abort(); window.removeEventListener("popstate", onBack); };
    // One refresh per workspace mount; subsequent refreshes are explicit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const area = scrollArea.current;
    if (area) area.scrollTop = area.scrollHeight;
  }, [chat?.messages.length, pending, loading]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || pending || loading) return;
    setPending(true); setError("");
    let activeChat = chat;
    try {
      if (!activeChat) {
        activeChat = (await api<{ chat: SavedChat }>("/api/chat/conversations", { method: "POST" })).chat;
        selected.current = activeChat.id; remember(activeChat); address(activeChat.id);
      }
      if (request.current?.chatId !== activeChat.id || request.current.text !== text) request.current = { id: crypto.randomUUID(), chatId: activeChat.id, text };
      const requestId = request.current.id;
      if (!activeChat.messages.some((item) => item.requestId === requestId && item.role === "user")) {
        setChat({ ...activeChat, messages: [...activeChat.messages, { id: requestId, requestId, role: "user", text, createdAt: new Date().toISOString() }] });
      }
      setDraft("");
      const data = await api<{ chat: SavedChat }>("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: text, chatId: activeChat.id, requestId }) });
      if (!mounted.current) return;
      remember(data.chat);
      if (selected.current === data.chat.id) setChat(data.chat);
      request.current = null;
    } catch (err) {
      if (!mounted.current) return;
      setError((err as Error).message);
      setDraft(text);
      if (activeChat) {
        const recovered = await api<{ chat: SavedChat }>("/api/chat/conversations/" + activeChat.id).catch(() => null);
        if (recovered && selected.current === activeChat.id && mounted.current) { setChat(recovered.chat); remember(recovered.chat); }
      }
    } finally { if (mounted.current) setPending(false); }
  }
  const visibleChats = chats.filter((item) => item.title.toLowerCase().includes(filter.toLowerCase()));
  const ready = snapshot?.sources.filter((source) => source.status === "ready").length || 0;
  const firstName = name.split(" ")[0];
  return <div className="chat-workspace">
    <a className="skip-link" href="#conversation">Skip to conversation</a>
    {sidebarOpen && <button className="chat-backdrop" aria-label="Close chat history" onClick={() => setSidebarOpen(false)} />}
    <aside className={`chat-sidebar ${sidebarOpen ? "is-open" : ""}`} aria-label="Chat history">
      <div className="chat-brand"><Link href="/chat">Yale<span>Hub</span></Link><button className="mobile-only icon-button" onClick={() => setSidebarOpen(false)} aria-label="Close chat history">×</button></div>
      <button className="new-chat" onClick={newChat} disabled={pending || loading}><span aria-hidden="true">＋</span> New chat <Icon name="chat" size={16} /></button>
      <label className="history-search"><Icon name="search" size={14} /><span className="sr-only">Search saved chats</span><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search your chats" /></label>
      <p className="history-label">Your conversations</p>
      <nav className="chat-history" aria-label="Saved conversations">{visibleChats.length ? visibleChats.map((item) => <button key={item.id} aria-current={selected.current === item.id ? "page" : undefined} onClick={() => void openChat(item.id)} disabled={pending || loading}><span>{item.title}</span><time dateTime={item.updatedAt}>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }).format(new Date(item.updatedAt))}</time></button>) : <p className="history-empty">{filter ? "No chats match your search." : "Your conversations will appear here, ready to pick up whenever you are."}</p>}</nav>
      <div className="chat-sidebar-bottom"><button className="sidebar-update" onClick={() => { setUpdatesOpen(true); setSidebarOpen(false); }}><Icon name="spark" size={17} /> Campus updates <span className={refreshing ? "refresh-dot pulsing" : "refresh-dot"} /></button><details className="workspace-links"><summary>More from your workspace</summary><Link href="/calendar">Calendar</Link><Link href="/courses">Courses</Link><Link href="/dining">Dining</Link><Link href="/canvas">Canvas</Link><Link href="/briefs">Morning brief</Link><Link href="/?view=dashboard">Dashboard</Link></details><div className="chat-account"><Link href="/profile"><span className="avatar">{firstName.slice(0, 1).toUpperCase()}</span><span>{name}<small>{netId} · Personal workspace</small></span></Link><a href="/api/auth/logout" aria-label="Sign out"><Icon name="logout" size={16} /></a></div></div>
    </aside>
    <main className="conversation-main" id="conversation">
      <header className="conversation-header"><div><button className="mobile-only icon-button" onClick={() => setSidebarOpen(true)} aria-label="Open chat history">☰</button><span className="conversation-title">{chat?.title || "Your personal Yale assistant"}</span></div><button className="connection-status" onClick={() => setUpdatesOpen(!updatesOpen)} aria-expanded={updatesOpen}><span className={refreshing ? "refresh-dot pulsing" : "refresh-dot"} />{refreshing ? "Refreshing campus" : snapshot?.completedAt ? `${ready} sources ready` : "Campus updates"}<Icon name="chevron" size={12} /></button></header>
      {updatesOpen && <section className="campus-updates" aria-label="Campus updates"><div className="section-heading"><div><h2>Your campus, caught up.</h2><p>{refreshing ? "Checking your connections in the background…" : snapshot?.completedAt ? "Last checked " + new Date(snapshot.completedAt).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }) + " Eastern" : "Refresh your connections to see the latest."}</p></div><div className="row"><button onClick={() => void refresh(true)} disabled={refreshing}>Refresh</button><button className="icon-button" aria-label="Close campus updates" onClick={() => setUpdatesOpen(false)}>×</button></div></div>{refreshError && <p className="banner" role="alert">{refreshError}</p>}<div className="source-grid">{snapshot?.sources.map((source) => <details key={source.id}><summary><span>{source.label}</span><span className={source.status === "ready" ? "source-ready" : "source-unavailable"}>{source.status === "ready" ? "Updated" : "Unavailable"}</span></summary><p>{source.text}</p></details>)}</div></section>}
      <div className="conversation-scroll" ref={scrollArea}>
        <div className="conversation-content">
          {loading ? <div className="chat-welcome"><p role="status">Opening your conversation…</p></div> : chat?.messages.length ? <div className="saved-messages">{chat.messages.map((message) => <article key={message.id} className={`saved-message ${message.role}`}><div className="saved-message-label">{message.role === "assistant" ? <><Icon name="spark" size={17} /> YaleHub</> : "You"}</div><MessageText text={message.text} />{message.toolsUsed?.length ? <details className="message-sources"><summary>{message.toolsUsed.length} tool calls</summary><p>{message.toolsUsed.map((tool) => tool.replaceAll("_", " ")).join(" · ")}</p></details> : null}{message.retrieved?.length ? <details className="message-sources"><summary>{message.retrieved.length} Yale sources consulted</summary>{message.retrieved.map((source, i) => <p key={i}>{source.excerpt}</p>)}</details> : null}{message.retrievalWarning && <details className="message-sources"><summary>Knowledge search unavailable</summary><p>{message.retrievalWarning}</p></details>}</article>)}</div> : <div className="chat-welcome"><span className="welcome-spark"><Icon name="spark" size={30} /></span><p className="eyebrow">A little less to keep in your head</p><h1>Hey {firstName}, let’s catch up.</h1>{snapshot?.greeting ? <div className="welcome-update"><MessageText text={snapshot.greeting} /><button className="update-details" onClick={() => setUpdatesOpen(true)}>View sources and connection details <Icon name="arrow" size={14} /></button></div> : <p className="welcome-description">{refreshing ? "I’m checking your calendar, coursework, dining, and campus connections. You can start chatting while I catch up." : "Your schedule, coursework, meals, and next big question. It all starts here."}</p>}<div className="chat-starters">{SUGGESTIONS.map((suggestion) => <button key={suggestion.title} onClick={() => { setDraft(suggestion.question); input.current?.focus(); }}><Icon name={suggestion.icon} size={19} /><span>{suggestion.title}</span><Icon name="arrow" size={13} /></button>)}</div></div>}
          {pending && <div className="assistant-working" role="status"><Icon name="spark" size={18} /><span>Thinking and checking your sources<span className="thinking-dots">…</span></span></div>}
        </div>
      </div>
      <div className="chat-composer-area">{error && <p className="banner" role="alert">{error}</p>}{refreshError && !updatesOpen && <button className="refresh-notice" onClick={() => setUpdatesOpen(true)}>Campus refresh needs attention. View details.</button>}<form className="full-chat-composer" onSubmit={send} aria-busy={pending}><label className="sr-only" htmlFor="message">Message YaleHub</label><textarea id="message" ref={input} value={draft} maxLength={10000} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder="Ask anything, or tell me what needs doing…" rows={2} disabled={pending || loading} /><div className="composer-actions"><span><Icon name="spark" size={13} /> Connected to your Yale life</span><button type="submit" aria-label="Send message" disabled={pending || loading || !draft.trim()}><Icon name="arrow" size={20} /></button></div></form><p className="composer-caption">Chats are saved to your workspace. Enter to send · Shift + Enter for a new line.</p></div>
    </main>
  </div>;
}
