"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SideNav, TopBar } from "./side-nav";

export function HubShell({ netId, children }: { netId: string | null; children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/chat") return <>{children}</>;
  return <div className="frame"><a className="skip-link" href="#main-content">Skip to content</a><SideNav netId={netId} /><div className="workspace"><TopBar /><main className="main" id="main-content">{children}</main><footer className="workspace-footer"><span>YaleHub / A little more connected.</span><span>New Haven, Connecticut</span></footer></div></div>;
}
