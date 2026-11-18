import { SignInGate } from "../../components/gate";
import { currentNetId } from "../../lib/session";
import { morningBriefFor } from "../../../src/core/mcp-server";
import { SendButton } from "./send-button";
import { BriefDocument } from "../../components/brief-document";

/** Aiden owns the email sender. This page previews the brief the agent assembles. */
export default async function BriefsPage() {
  const netId = await currentNetId();
  if (!netId) {
    return <SignInGate title="Morning brief" detail="Sign in to preview the email and send a test." />;
  }
  const markdown = await morningBriefFor(netId);
  return (
    <>
      <header className="page-head">
        <p className="eyebrow">The daily edit</p>
        <h1>Your morning, made simpler.</h1>
        <p className="lede">A moment to get your bearings. Here’s your schedule, coursework, and campus dining in one read.</p>
      </header>
      <SendButton />
      <BriefDocument text={markdown} />
    </>
  );
}
