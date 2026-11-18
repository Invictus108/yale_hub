import type { ReactNode } from "react";

import "./globals.css";

export const metadata = {
  title: "YaleHub",
  description: "Personal hub for a Yale student.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
