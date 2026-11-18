import Link from "next/link";

import { currentNetId } from "../lib/session";
import { morningBriefFor } from "../../src/core/mcp-server";
import { SendButton } from "./send-button";

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
