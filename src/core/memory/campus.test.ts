import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { campusContext, readCampus, refreshCampus } from "./campus";
import { createEvent } from "../../integrations/gcal";

const previousCwd = process.cwd();
const directory = await mkdtemp(path.join(os.tmpdir(), "yalehub-campus-test-"));
process.chdir(directory);
const keys = ["CANVAS_API_TOKEN", "YALIES_API_KEY", "SMTP_HOST", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "YALEHUB_MEMORY_DIR"];
const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
for (const key of keys) process.env[key] = "";
after(async () => {
  process.chdir(previousCwd);
  for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
  assert.equal(path.dirname(directory), os.tmpdir());
  assert.ok(path.basename(directory).startsWith("yalehub-campus-test-"));
  await rm(directory, { recursive: true, force: true });
});

test("startup refresh uses real MCP reads, isolates students, and reports missing connections", async () => {
  const start = new Date(Date.now() + 3600000).toISOString();
  const end = new Date(Date.now() + 7200000).toISOString();
  await createEvent("qa11", { title: "Only student eleven", start, end });
  await createEvent("qa12", { title: "Only student twelve", start, end });
  const first = refreshCampus("qa11");
  assert.equal(refreshCampus("qa11"), first, "same-student refreshes must share a job");
  const [one, two] = await Promise.all([first, refreshCampus("qa12")]);
  assert.equal(one.refreshing, false);
  assert.equal(one.sources.length, 9);
  assert.match(one.sources.find((source) => source.id === "calendar")!.text, /Only student eleven/);
  assert.doesNotMatch(campusContext(one), /Only student twelve/);
  assert.match(two.sources.find((source) => source.id === "calendar")!.text, /Only student twelve/);
  assert.equal(one.sources.find((source) => source.id === "todo")!.status, "unavailable");
  assert.match(one.greeting, /unavailable/);
  assert.deepEqual(await readCampus("qa11"), one);
  const cached = await refreshCampus("qa11");
  assert.equal(cached.completedAt, one.completedAt);
  const refreshed = await refreshCampus("qa11", true);
  assert.notEqual(refreshed.startedAt, one.startedAt);
});
