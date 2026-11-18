"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icon";

const LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Overview", icon: "home" },
  { href: "/chat", label: "Your assistant", icon: "chat" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/courses", label: "Courses", icon: "courses" },
  { href: "/canvas", label: "Canvas", icon: "canvas" },
  { href: "/dining", label: "Dining", icon: "dining" },
  { href: "/briefs", label: "Morning brief", icon: "briefs" },
];

export function SideNav({ netId }: { netId: string | null }) {
  const pathname = usePathname();
  return (
    <aside className="side">
      <Link href="/" className="brand" aria-label="YaleHub home"><span className="brand-mark">Y</span><span>Yale<span className="brand-light">Hub</span><small>YOUR CAMPUS, CONNECTED</small></span></Link>
      <p className="nav-label">Workspace</p>
      <nav aria-label="Main navigation">
        {LINKS.map(({ href, label, icon }) => <Link key={href} href={href} aria-current={(href === "/" ? pathname === "/" : pathname.startsWith(href)) ? "page" : undefined}><Icon name={icon} /><span>{label}</span>{href === "/chat" && <span className="nav-badge">AI</span>}</Link>)}
      </nav>
      <div className="side-note"><span className="side-note-icon"><Icon name="spark" /></span><strong>A little less juggling.</strong><p>A little more Yale. Keep your campus life in one place.</p><Link href="/chat">Ask your assistant <Icon name="arrow" size={16} /></Link></div>
      <div className="account">
        <Link href={netId ? "/profile" : "/login"} className="account-profile" aria-current={pathname === "/profile" ? "page" : undefined}><span className="avatar">{netId ? netId.slice(0, 2).toUpperCase() : "Y"}</span><span><strong>{netId || "Your YaleHub"}</strong><small>{netId ? "Personal workspace" : "Sign in to get started"}</small></span></Link>
        {netId && <a href="/api/auth/logout" className="logout" aria-label="Sign out" title="Sign out"><Icon name="logout" size={18} /></a>}
      </div>
    </aside>
  );
}

export function TopBar() {
  const pathname = usePathname();
  const label = pathname === "/profile" ? "Your profile" : LINKS.find((link) => link.href === pathname)?.label || "Workspace";
  return <header className="topbar"><div className="breadcrumb"><span>My workspace</span><Icon name="chevron" size={13} /><strong>{label}</strong></div><Link href="/profile" className="topbar-link"><Icon name="profile" size={16} /> My profile</Link></header>;
}
