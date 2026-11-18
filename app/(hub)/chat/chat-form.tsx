"use client";

import { useRef, useState, type FormEvent } from "react";
import { Icon, type IconName } from "../../components/icon";

interface Chunk { score: number; excerpt: string; }
interface Turn { question: string; answer: string; warning?: string; retrieved: Chunk[]; }
const SUGGESTIONS: { question: string; icon: IconName }[] = [
  { question: "What is on my calendar today?", icon: "calendar" },
  { question: "What is for dinner at my college?", icon: "dining" },
  { question: "Tell me about Directed Studies.", icon: "courses" },
];

export function ChatForm({ initialQuestion = "" }: { initialQuestion?: string }) {
  const [draft, setDraft] = useState(initialQuestion);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const input = useRef<HTMLTextAreaElement>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const body = (await response.json()) as { error?: string; text?: string; retrievalWarning?: string; retrieved?: Chunk[]; };
      if (!response.ok || body.error) throw new Error(body.error || "We couldn’t get a reply. Please try again.");
      setTurns((current) => [...current, {
        question: message, answer: body.text || "No reply.",
        ...(body.retrievalWarning ? { warning: body.retrievalWarning } : {}),
        retrieved: body.retrieved || [],
      }]);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return <div className="chat">
    {turns.length === 0 ? <div className="empty">
      <span className="chat-emblem"><Icon name="spark" size={28} /></span>
      <h2>What’s on your mind?</h2>
      <p className="muted">Yale knowledge, your plans, and a memory for the details. Ask a question or start with one below.</p>
    </div> : <div className="thread" aria-live="polite">
      {turns.map((turn, index) => <article key={index}>
        <p className="bubble user">{turn.question}</p>
        <p className="message-label"><Icon name="spark" size={15} /> YaleHub</p>
        <p className="bubble hub">{turn.answer}</p>
        {turn.warning && <p className="banner">{turn.warning}</p>}
        {turn.retrieved.length > 0 && <details className="sources"><summary>{turn.retrieved.length} Yale sources consulted</summary><ol>{turn.retrieved.map((chunk, chunkIndex) => <li key={chunkIndex}><span className="pill">Relevance {chunk.score.toFixed(3)}</span><p>{chunk.excerpt}</p></li>)}</ol></details>}
      </article>)}
    </div>}
    {turns.length === 0 && <div className="suggestions">{SUGGESTIONS.map(({ question, icon }) => <button key={question} type="button" disabled={pending} onClick={() => { setDraft(question); input.current?.focus(); }}><Icon name={icon} size={19} />{question}</button>)}</div>}
    <form className="composer" onSubmit={onSubmit} aria-busy={pending}>
      <label className="sr-only" htmlFor="chat-message">Your message</label>
      <textarea id="chat-message" ref={input} name="message" required disabled={pending} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask anything about your Yale day…" />
      <div className="composer-bottom"><span>{pending ? "Looking through Yale knowledge. This may take a moment." : "Personal to you. Grounded in Yale knowledge."}</span><button type="submit" disabled={pending || !draft.trim()}>{pending ? "Thinking…" : "Send message"}<Icon name="arrow" size={17} /></button></div>
    </form>
    {error && <p className="banner" role="alert">{error}</p>}
    {pending && <p className="status" role="status">Your assistant is working on it…</p>}
  </div>;
}
