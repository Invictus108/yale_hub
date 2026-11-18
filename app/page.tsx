import Link from "next/link";

import { currentNetId } from "./lib/session.js";
import { featureModules } from "../src/core/mcp-server.js";

/** Aiden owns this overview. New modules appear here once they are registered. */
export default async function OverviewPage() {
  const netId = await currentNetId();
  return (
    <>
      <h1>YaleHub</h1>
      <p>{netId ? `Signed in as ${netId}.` : "Sign in with a NetID to use the hub."}</p>
      <ul>
        <li><Link href="/profile">Profile</Link> — memory owner</li>
        <li><Link href="/chat">Chat</Link> — agent retrieves Yale chunks, then calls MCP tools</li>
        <li><Link href="/calendar">Calendar</Link> — Jack</li>
        <li><Link href="/dining">Dining</Link> — Aiden</li>
        <li><Link href="/courses">Courses</Link> — Aiden</li>
        <li><Link href="/briefs">Morning brief</Link> — Aiden</li>
      </ul>
      <h2>Registered modules</h2>
      <ul>
        {featureModules.map((mod) => (
          <li key={mod.id}>
            {mod.name} ({mod.owner}): {mod.tools.map((tool) => tool.name).join(", ")}
          </li>
        ))}
      </ul>
    </>
  );
}
