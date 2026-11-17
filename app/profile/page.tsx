import Link from "next/link";

import { currentNetId } from "../lib/session";
import { recentEpisodes } from "../../src/core/memory/episodic";
import { loadOrCreateProfile } from "../../src/core/memory/profile";
import { ProfileForm } from "./profile-form";

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
  const episodes = await recentEpisodes(netId, 8);
  return (
    <>
      <h1>Profile</h1>
      <ProfileForm profile={profile} />
      <h2>Recent memory</h2>
      {episodes.length === 0 ? (
        <p>No episodes yet. They show up after you chat.</p>
      ) : (
        <ul>
          {episodes.map((episode) => (
            <li key={episode.id}>
              {episode.at} {episode.summary}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
