"use client";

import { useState, type FormEvent } from "react";

import type { Profile } from "../../src/core/types.js";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [status, setStatus] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: form.get("displayName"),
        college: form.get("college"),
        classYear: form.get("classYear"),
        major: form.get("major"),
        pronouns: form.get("pronouns"),
      }),
    });
    const body = (await response.json()) as { error?: string; displayName?: string };
    setStatus(body.error ?? `Saved ${body.displayName ?? "profile"}.`);
  }

  return (
    <form onSubmit={onSubmit}>
      <label>Name <input name="displayName" defaultValue={profile.displayName} /></label>
      <label>College <input name="college" defaultValue={profile.college ?? ""} /></label>
      <label>Class year <input name="classYear" defaultValue={profile.classYear ?? ""} /></label>
      <label>Major <input name="major" defaultValue={profile.major ?? ""} /></label>
      <label>Pronouns <input name="pronouns" defaultValue={profile.pronouns ?? ""} /></label>
      <button type="submit">Save</button>
      <p>{status}</p>
    </form>
  );
}
