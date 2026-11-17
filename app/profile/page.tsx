import Link from "next/link";

import { currentNetId } from "../lib/session.js";
import { loadOrCreateProfile } from "../../src/core/memory/profile.js";
import { ProfileForm } from "./profile-form.js";

export default async function ProfilePage() {
  const netId = await currentNetId();
  if (!netId) {
    return (
      <>
        <h1>Profile</h1>
        <p><Link href="/login">Sign in</Link> to view your profile.</p>
      </>
    );
  }
  const profile = await loadOrCreateProfile(netId);
  return (
    <>
      <h1>Profile</h1>
      <ProfileForm profile={profile} />
    </>
  );
}
