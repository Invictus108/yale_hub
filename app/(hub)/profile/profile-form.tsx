"use client";

import { useState, type FormEvent } from "react";

import type { Profile } from "../../../src/core/types";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [status, setStatus] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus("Saving…");
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
    <form className="panel" onSubmit={onSubmit}>
      <h2>About you</h2>
      <div className="fields">
        <label>Name <input name="displayName" defaultValue={profile.displayName} autoComplete="name" /></label>
        <label>Pronouns <input name="pronouns" defaultValue={profile.pronouns ?? ""} /></label>
        <label>College <input name="college" defaultValue={profile.college ?? ""} /></label>
        <label>Class year <input name="classYear" inputMode="numeric" defaultValue={profile.classYear ?? ""} /></label>
        <label>Major <input name="major" defaultValue={profile.major ?? ""} /></label>
        <label>Email <input name="email" defaultValue={profile.email ?? ""} readOnly /></label>
      </div>
      <button type="submit">Save profile</button>
      <p className="status" role="status">{status}</p>
    </form>
  );
}
