"use client";

import { useState } from "react";

export function SendButton() {
  const [detail, setDetail] = useState("");

  async function send() {
    setDetail("Sending…");
    const response = await fetch("/api/briefs/send", { method: "POST" });
    const body = (await response.json()) as { error?: string; detail?: string; transport?: string };
    setDetail(body.error ?? `${body.transport ?? "sent"}: ${body.detail ?? ""}`);
  }

  return (
    <div className="row">
      <button type="button" onClick={send}>Send test email</button>
      {detail ? <p className="status" role="status">{detail}</p> : null}
    </div>
  );
}
