import type { ReactNode } from "react";
import Link from "next/link";

import { currentNetId } from "./lib/session";
import "./globals.css";

/** Aiden owns the dashboard shell. Pages under app/calendar belong to Jack. */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const netId = await currentNetId();
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <nav>
            <Link href="/">Overview</Link>
            <Link href="/profile">Profile</Link>
            <Link href="/chat">Chat</Link>
            <Link href="/calendar">Calendar</Link>
            <Link href="/dining">Dining</Link>
            <Link href="/courses">Courses</Link>
            <Link href="/briefs">Briefs</Link>
            <span className="who">
              {netId ? (
                <>
                  {netId} · <Link href="/api/auth/logout">Sign out</Link>
                </>
              ) : (
                <Link href="/login">Sign in</Link>
              )}
            </span>
          </nav>
          <main className="card">{children}</main>
        </div>
      </body>
    </html>
  );
}
