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
    const body = (await response.json()) as { error?: string; text?: string };
    setOutput(body.error ?? body.text ?? "No reply.");
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
