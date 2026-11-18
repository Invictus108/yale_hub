import { randomUUID } from "node:crypto";
import { answerQuestion } from "./agent";
import { ChatError, readChat, saveChat, withChatLock } from "./memory/chat-store";
import type { SavedChat } from "./memory/chat-types";

export async function sendChatMessage(netId: string, id: string, message: string, requestId: string, answer: typeof answerQuestion = answerQuestion): Promise<SavedChat> {
  return withChatLock(netId, id, async () => {
    const chat = await readChat(netId, id);
    const prior = chat.messages.find((item) => item.role === "user" && item.requestId === requestId);
    if (prior) {
      if (prior.text !== message) throw new ChatError("This request ID has already been used for a different message.", 409);
      if (chat.messages.some((item) => item.role === "assistant" && item.requestId === requestId)) return chat;
      // Never replay a possibly completed external action after a process interruption.
      throw new ChatError("This message was saved, but its reply was interrupted. Reopen the chat and ask the assistant to check the result before trying an action again.", 409);
    }
    if (chat.messages.length >= 500) throw new ChatError("This conversation is full. Start a new chat to continue.");
    const history = chat.messages.slice(-40);
    const now = new Date().toISOString();
    chat.messages.push({ id: randomUUID(), role: "user", text: message, createdAt: now, requestId });
    if (!history.some((entry) => entry.role === "user")) chat.title = message.replace(/\s+/g, " ").slice(0, 70);
    chat.updatedAt = now;
    await saveChat(netId, chat);
    try {
      const turn = await answer(netId, message, history);
      chat.messages.push({
        id: randomUUID(), role: "assistant", text: turn.text, createdAt: new Date().toISOString(),
        requestId, retrieved: turn.retrieved, toolsUsed: turn.toolsUsed,
        ...(turn.retrievalWarning ? { retrievalWarning: turn.retrievalWarning } : {}),
      });
    } catch {
      chat.messages.push({ id: randomUUID(), role: "assistant", requestId, createdAt: new Date().toISOString(), failed: true,
        text: "I couldn’t finish this reply. Your message is saved. If you requested an action, ask me to check its result before trying again." });
    }
    chat.updatedAt = new Date().toISOString();
    await saveChat(netId, chat);
    return chat;
  });
}
