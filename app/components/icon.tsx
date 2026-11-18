import type { CSSProperties } from "react";

const paths = {
  home: "M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z",
  chat: "M21 11.5a8.5 8.5 0 0 1-8.5 8.5H5l-3 2 1.5-6A8.5 8.5 0 1 1 21 11.5ZM7 10h10M7 14h6",
  calendar: "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM7 3v4m10-4v4M3 10h18M7 14h2m4 0h4m-10 3h2",
  dining: "M4 3v6a3 3 0 0 0 6 0V3M7 3v18M19 21V3c-4 3-5 8 0 9",
  courses: "M12 6v15M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2Z",
  canvas: "M9 5H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-4M9 3h6v4H9ZM7 13l2 2 4-4m-6 8h10",
  briefs: "M4 4h16v16H4ZM8 8h8M8 12h8m-8 4h5",
  profile: "M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  chevron: "m9 5 7 7-7 7",
  spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z",
  logout: "M9 4H4v16h5m5-13 5 5-5 5m-6-5h11",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2",
  check: "m5 12 4 4L19 6",
  search: "M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
} as const;

export type IconName = keyof typeof paths;
export function Icon({ name, size = 20, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={paths[name]} /></svg>;
}
