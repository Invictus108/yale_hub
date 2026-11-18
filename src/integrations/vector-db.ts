import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { RetrievedChunk } from "../core/types";

const scriptPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "vector_bridge.py");

/**
 * Thin wrapper around the existing Yale chunk index.
 * One long-lived Python process loads BGE and the reranker once, then answers JSON lines.
 */
let child: ChildProcessWithoutNullStreams | null = null;
let stdoutBuffer = "";
let pending: ((line: string) => void) | null = null;
const readyLines: string[] = [];
let chain: Promise<unknown> = Promise.resolve();

function pythonCommand(): string {
  return process.env.PYTHON?.trim() || "python";
}

function startWorker(): ChildProcessWithoutNullStreams {
  const proc = spawn(pythonCommand(), [scriptPath], {
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
    env: {
      ...process.env,
      PYTHONUNBUFFERED: "1",
      PYTHONIOENCODING: "utf-8",
      HF_HUB_DISABLE_PROGRESS_BARS: "1",
      TOKENIZERS_PARALLELISM: "false",
      TRANSFORMERS_VERBOSITY: "error",
    },
  });

  proc.stdout.setEncoding("utf8");
  proc.stdout.on("data", (chunk: string) => {
    stdoutBuffer += chunk;
    let newline = stdoutBuffer.indexOf("\n");
    while (newline >= 0) {
      const line = stdoutBuffer.slice(0, newline);
      stdoutBuffer = stdoutBuffer.slice(newline + 1);
      deliverLine(line);
      newline = stdoutBuffer.indexOf("\n");
    }
  });

  proc.stderr.setEncoding("utf8");
  proc.stderr.on("data", (chunk: string) => {
    process.stderr.write(`[vector-db] ${chunk}`);
  });

  proc.on("exit", (code) => {
    if (child === proc) child = null;
    const waiter = pending;
    pending = null;
    if (waiter) waiter(JSON.stringify({ error: `vector bridge exited (${code ?? "signal"})` }));
  });

  return proc;
}

function deliverLine(line: string): void {
  if (pending) {
    const waiter = pending;
    pending = null;
    waiter(line);
    return;
  }
  readyLines.push(line);
}

function ensureWorker(): ChildProcessWithoutNullStreams {
  if (child && child.exitCode === null && !child.killed) return child;
  stdoutBuffer = "";
  readyLines.length = 0;
  child = startWorker();
  return child;
}

function requestLine(query: string, k: number): Promise<string> {
  const proc = ensureWorker();
  readyLines.length = 0;
  return new Promise((resolve, reject) => {
    if (pending) {
      reject(new Error("vector bridge already has a request in flight"));
      return;
    }
    let settled = false;
    const finish = (line: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (pending === finish) pending = null;
      resolve(line);
    };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      if (pending === finish) pending = null;
      proc.kill();
      child = null;
      reject(new Error("vector bridge timed out (the first call loads BGE and the reranker and can take several minutes)"));
    }, 600_000);

    pending = finish;
    proc.stdin.write(JSON.stringify({ query, k }) + "\n", (err) => {
      if (!err || settled) return;
      settled = true;
      clearTimeout(timer);
      if (pending === finish) pending = null;
      reject(err);
    });
  });
}

export async function searchYaleKnowledge(query: string, k = 5): Promise<RetrievedChunk[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const take = Math.max(1, Math.min(k, 10));

  const run = chain.then(() => requestLine(trimmed, take));
  chain = run.then(
    () => undefined,
    () => undefined,
  );

  const line = await run;
  let parsed: { chunks?: RetrievedChunk[]; error?: string };
  try {
    parsed = JSON.parse(line) as { chunks?: RetrievedChunk[]; error?: string };
  } catch {
    throw new Error(`vector bridge returned non-JSON: ${line.slice(0, 200)}`);
  }
  if (parsed.error) throw new Error(parsed.error);
  return (parsed.chunks ?? []).map((chunk) => ({
    text: String(chunk.text ?? ""),
    score: Number(chunk.score ?? 0),
  }));
}

process.on("exit", () => {
  child?.kill();
});
