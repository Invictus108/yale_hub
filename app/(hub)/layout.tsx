import type { ReactNode } from "react";
import { SideNav, TopBar } from "../components/side-nav";
import { currentNetId } from "../lib/session";

export default async function HubLayout({ children }: { children: ReactNode }) {
  const netId = await currentNetId();
  return (
    <div className="frame">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <SideNav netId={netId} />
      <div className="workspace"><TopBar /><main className="main" id="main-content">{children}</main><footer className="workspace-footer"><span>YaleHub <span aria-hidden="true">/</span> A little more connected.</span><span>New Haven, Connecticut</span></footer></div>
    </div>
  );
}
