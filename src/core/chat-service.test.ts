import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { createChat, listChats, readChat, saveChat, ChatError } from "./memory/chat-store";
import { sendChatMessage } from "./chat-service";
import type { AgentTurn } from "./agent";

const directory = await mkdtemp(path.join(os.tmpdir(), "yalehub-chat-test-"));
process.env.YALEHUB_MEMORY_DIR = directory;
after(async () => {
  // Only delete the unique directory allocated by this test.
  assert.equal(path.dirname(directory), os.tmpdir());
  assert.ok(path.basename(directory).startsWith("yalehub-chat-test-"));
  await rm(directory, { recursive: true, force: true });
  delete process.env.YALEHUB_MEMORY_DIR;
});
const reply = (text: string): AgentTurn => ({ text, retrieved: [], toolsUsed: [], model: true });

test("saved chats survive rereads and cannot be accessed by another NetID", async () => {
  const chat = await createChat("qa01", "Welcome back.");
  const saved = await sendChatMessage("qa01", chat.id, "Plan my afternoon", randomUUID(), async () => reply("Let’s plan."));
  assert.deepEqual(await readChat("qa01", chat.id), saved);
  assert.equal(saved.title, "Plan my afternoon");
  assert.equal(saved.messages.length, 3);
  assert.equal((await listChats("qa01"))[0]?.messageCount, 3);
  await assert.rejects(readChat("qa02", chat.id), (err) => err instanceof ChatError && err.status === 404);
  await assert.rejects(readChat("qa01", "../../profiles/qa02"), /Invalid chat ID/);
  assert.deepEqual(await readdir(path.join(directory, "qa01", "chats")), [chat.id + ".json"]);
});

test("duplicate concurrent requests invoke the agent only once", async () => {
  const chat = await createChat("qa03");
  const requestId = randomUUID();
  let calls = 0;
  const answer = async () => { calls++; return reply("Created."); };
  const results = await Promise.all([
    sendChatMessage("qa03", chat.id, "Add an event", requestId, answer),
    sendChatMessage("qa03", chat.id, "Add an event", requestId, answer),
  ]);
  assert.equal(calls, 1);
  assert.deepEqual(results[0], results[1]);
  assert.equal(results[0].messages.length, 2);
  await assert.rejects(sendChatMessage("qa03", chat.id, "Different action", requestId, answer), /different message/);
});

test("concurrent turns are ordered and follow-ups receive this chat's history", async () => {
  const chat = await createChat("qa04");
  const other = await createChat("qa04");
  await sendChatMessage("qa04", other.id, "Private other conversation", randomUUID(), async () => reply("Other reply"));
  const first = sendChatMessage("qa04", chat.id, "Find courses", randomUUID(), async (_id, _text, history) => {
    assert.equal(history?.length, 0);
    return reply("Two courses found.");
  });
  const second = sendChatMessage("qa04", chat.id, "Save the second one", randomUUID(), async (_id, _text, history) => {
    assert.deepEqual(history?.map((entry) => entry.text), ["Find courses", "Two courses found."]);
    return reply("Saved the second course.");
  });
  await Promise.all([first, second]);
  assert.equal((await readChat("qa04", chat.id)).messages.length, 4);
});

test("agent failure preserves the user message and an honest failure response", async () => {
  const chat = await createChat("qa05");
  const result = await sendChatMessage("qa05", chat.id, "Move my meeting", randomUUID(), async () => { throw new Error("Network failure"); });
  assert.equal(result.messages[0].text, "Move my meeting");
  assert.equal(result.messages[1].failed, true);
  assert.equal((await readChat("qa05", chat.id)).messages.length, 2);
});

test("an interrupted saved request is not replayed after restart", async () => {
  const chat = await createChat("qa06");
  const requestId = randomUUID();
  chat.messages.push({ id: randomUUID(), role: "user", text: "Send my brief", createdAt: new Date().toISOString(), requestId });
  await saveChat("qa06", chat);
  let calls = 0;
  await assert.rejects(sendChatMessage("qa06", chat.id, "Send my brief", requestId, async () => { calls++; return reply("Sent"); }), /interrupted/);
  assert.equal(calls, 0);
});
