"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SaveCourseButton({ crn, seasonCode }: { crn: number; seasonCode: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState("");

  async function save() {
    setDetail("Saving…");
    const response = await fetch("/api/courses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "save", crn, seasonCode }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      setDetail(body.error ?? "Could not save.");
      return;
    }
    setDetail("");
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={save}>Save</button>
      {detail ? <span> {detail}</span> : null}
    </>
  );
}

export function RemoveCourseButton({ crn, seasonCode }: { crn: number; seasonCode: string }) {
  const router = useRouter();
  const [detail, setDetail] = useState("");

  async function remove() {
    setDetail("Removing…");
    const response = await fetch("/api/courses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "remove", crn, seasonCode }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) {
      setDetail(body.error ?? "Could not remove.");
      return;
    }
    router.refresh();
  }

  return (
    <>
      <button type="button" onClick={remove}>Remove</button>
      {detail ? <span> {detail}</span> : null}
    </>
  );
}
