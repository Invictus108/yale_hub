export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  requestId?: string;
  retrieved?: Array<{ score: number; excerpt: string }>;
  toolsUsed?: string[];
  retrievalWarning?: string;
  failed?: boolean;
}
export interface SavedChat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}
export type ChatSummary = Omit<SavedChat, "messages"> & { messageCount: number };
export interface CampusSource {
  id: string;
  label: string;
  status: "ready" | "unavailable";
  text: string;
  updatedAt: string;
}
export interface CampusSnapshot {
  startedAt: string;
  completedAt: string | null;
  refreshing: boolean;
  sources: CampusSource[];
  greeting: string;
}
