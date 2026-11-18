"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function EventForm() {
  const router = useRouter();
  const [detail, setDetail] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    setDetail("Saving…");
    const response = await fetch("/api/calendar/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: form.get("title"),
        start: form.get("start"),
        end: form.get("end"),
        location: form.get("location"),
      }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      setDetail(body.error ?? "Could not save the event.");
      return;
    }
    formEl.reset();
    setDetail("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <label>
        Title
        <input name="title" required />
      </label>
      <label>
        Start
        <input name="start" type="datetime-local" required />
      </label>
      <label>
        End
        <input name="end" type="datetime-local" required />
      </label>
      <label>
        Location
        <input name="location" />
      </label>
      <button type="submit">Add event</button>
      {detail ? <p>{detail}</p> : null}
    </form>
  );
}

export function DeleteEventButton({ id }: { id: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState("");

  async function remove() {
    setDetail("Removing…");
    const response = await fetch(`/api/calendar/events?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      setDetail(body.error ?? "Could not delete the event.");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={remove}>Delete</button>
      {detail ? <span> {detail}</span> : null}
    </>
  );
}
