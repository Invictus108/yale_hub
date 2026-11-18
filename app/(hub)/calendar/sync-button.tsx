"use client";

import { useState } from "react";

export function SyncButton() {
  const [detail, setDetail] = useState("");

  async function run() {
    setDetail("Running…");
    const response = await fetch("/api/calendar", { method: "POST" });
    const body = (await response.json()) as { error?: string; detail?: string; status?: string };
    setDetail(body.error ?? `${body.status ?? "done"}: ${body.detail ?? ""}`);
  }

  return (
    <div className="row">
      <button type="button" onClick={run}>Run auto-update</button>
      {detail ? <p className="status" role="status">{detail}</p> : null}
    </div>
  );
}
