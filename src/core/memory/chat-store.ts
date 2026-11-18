import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertNetId } from "./profile";
import type { SavedChat, ChatSummary } from "./chat-types";

export class ChatError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export function memoryDirectory(netId: string): string {
  return path.resolve(process.env.YALEHUB_MEMORY_DIR || path.join(process.cwd(), "data", "episodes"), assertNetId(netId));
}
export function assertChatId(id: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw new ChatError("Invalid chat ID.");
  return id;
}
function chatFile(netId: string, id: string) {
  return path.join(memoryDirectory(netId), "chats", assertChatId(id) + ".json");
}
export async function atomicJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = file + "." + randomUUID() + ".tmp";
  try {
    await writeFile(temporary, JSON.stringify(value), "utf8");
    await rename(temporary, file);
  } finally { await unlink(temporary).catch(() => {}); }
}
const locks = new Map<string, Promise<void>>();
export async function withChatLock<T>(netId: string, id: string, work: () => Promise<T>): Promise<T> {
  const key = chatFile(netId, id);
  const previous = locks.get(key) || Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.then(() => next);
  locks.set(key, tail);
  await previous;
  try { return await work(); }
  finally { release(); if (locks.get(key) === tail) locks.delete(key); }
}
export async function readChat(netId: string, id: string): Promise<SavedChat> {
  try { return JSON.parse(await readFile(chatFile(netId, id), "utf8")) as SavedChat; }
  catch (err) { if ((err as NodeJS.ErrnoException).code === "ENOENT") throw new ChatError("Chat not found.", 404); throw err; }
}
export async function saveChat(netId: string, chat: SavedChat): Promise<void> {
  await atomicJson(chatFile(netId, chat.id), chat);
}
export async function createChat(netId: string, greeting?: string): Promise<SavedChat> {
  const now = new Date().toISOString();
  const chat: SavedChat = { id: randomUUID(), title: "New chat", createdAt: now, updatedAt: now, messages: greeting ? [{ id: randomUUID(), role: "assistant", text: greeting, createdAt: now }] : [] };
  await saveChat(netId, chat);
  return chat;
}
export async function listChats(netId: string): Promise<ChatSummary[]> {
  const directory = path.join(memoryDirectory(netId), "chats");
  let files: string[];
  try { files = await readdir(directory); }
  catch (err) { if ((err as NodeJS.ErrnoException).code === "ENOENT") return []; throw err; }
  const chats = await Promise.all(files.filter((file) => file.endsWith(".json")).map(async (file) => {
    const chat = await readChat(netId, file.slice(0, -5));
    const { messages, ...summary } = chat;
    return { ...summary, messageCount: messages.length };
  }));
  return chats.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
