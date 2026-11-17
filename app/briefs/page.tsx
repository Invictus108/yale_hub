import Link from "next/link";

import { currentNetId } from "../lib/session.js";
import { morningBriefFor } from "../../src/core/mcp-server.js";
import { SendButton } from "./send-button.js";

/** Aiden owns this page and the email sender. */
export default async function BriefsPage() {
  const netId = await currentNetId();
  if (!netId) {
    return (
      <>
        <h1>Morning brief</h1>
        <p><Link href="/login">Sign in</Link> to preview the email.</p>
      </>
    );
  }
  const markdown = await morningBriefFor(netId);
  return (
    <>
      <h1>Morning brief</h1>
      <SendButton />
      <pre>{markdown}</pre>
    </>
  );
}
