import { SignInGate } from "../../components/gate";
import { currentNetId } from "../../lib/session";
import { recentEpisodes } from "../../../src/core/memory/episodic";
import { loadOrCreateProfile } from "../../../src/core/memory/profile";
import { ProfileForm } from "./profile-form";

const when = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default async function ProfilePage() {
  const netId = await currentNetId();
  if (!netId) {
    return <SignInGate title="Profile" detail="Sign in to view and edit the profile the agent remembers." />;
  }
  const profile = await loadOrCreateProfile(netId);
  const episodes = await recentEpisodes(netId, 8);
  return (
    <>
      <header className="page-head">
        <p className="eyebrow">Your corner of Yale</p>
        <h1>{profile.displayName}</h1>
        <p className="lede">The little details that make this space yours. Keep your profile up to date for a more personal experience.</p>
      </header>
      <div className="split">
        <ProfileForm profile={profile} />
        <section>
          <h2>Remembered along the way</h2>
          {episodes.length === 0 ? (
            <div className="empty">
              <p className="muted">A fresh start. As you chat, the things worth remembering will appear here.</p>
            </div>
          ) : (
            <ul className="memory">
              {episodes.map((episode) => (
                <li key={episode.id}>
                  <time className="when" dateTime={episode.at}>{when.format(new Date(episode.at))}</time>
                  <p className="summary">{episode.summary}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
