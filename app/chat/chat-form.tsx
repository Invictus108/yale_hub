"use client";

import { useState, type FormEvent } from "react";

export function ChatForm() {
  const [output, setOutput] = useState("Ask something about Yale or your week.");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = String(new FormData(event.currentTarget).get("message") ?? "");
    setOutput("Working…");
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const body = (await response.json()) as {
      error?: string;
      text?: string;
      retrievalWarning?: string;
      retrieved?: Array<{ score: number; excerpt: string }>;
    };
    if (body.error) {
      setOutput(body.error);
      return;
    }
    const sources = (body.retrieved ?? [])
      .map((chunk, index) => `(${index + 1}) ${chunk.score.toFixed(3)}\n${chunk.excerpt}`)
      .join("\n\n");
    setOutput(
      [
        body.text ?? "No reply.",
        body.retrievalWarning ? `Retrieval warning: ${body.retrievalWarning}` : "",
        sources ? `Yale chunks loaded before the reply:\n${sources}` : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    );
  }

  return (
    <>
      <form onSubmit={onSubmit}>
        <label>
          Question
          <textarea name="message" required placeholder="What's on my plate today?" />
        </label>
        <button type="submit">Ask</button>
      </form>
      <pre>{output}</pre>
    </>
  );
}
