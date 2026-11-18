import type { ReactNode } from "react";
import { HubShell } from "../components/hub-shell";
import { currentNetId } from "../lib/session";

export default async function HubLayout({ children }: { children: ReactNode }) {
  const netId = await currentNetId();
  return (
    <HubShell netId={netId}>{children}</HubShell>
  );
}
