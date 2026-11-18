import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import nodemailer from "nodemailer";

/**
 * Aiden owns morning-email delivery.
 * With SMTP_HOST unset, sendMorningEmail records the message in data/briefs/
 * so the dashboard button still leaves a copy you can read.
 */

export interface BriefSendResult {
  transport: "outbox" | "smtp";
  to: string;
  subject: string;
  accepted: boolean;
  detail: string;
}

export interface OutboxEntry {
  at: string;
  to: string;
  subject: string;
  transport: "outbox" | "smtp";
  detail: string;
}

function safeNetId(raw: string): string {
  const netId = raw.trim().toLowerCase();
  if (!/^[a-z][a-z0-9]{1,7}$/.test(netId)) throw new Error("Invalid NetID.");
  return netId;
}

function outboxFile(netId: string): string {
  return path.resolve(process.cwd(), "data", "briefs", safeNetId(netId), "outbox.json");
}

export async function recentSends(netId: string): Promise<OutboxEntry[]> {
  try {
    const parsed = JSON.parse(await readFile(outboxFile(netId), "utf8")) as { sent?: OutboxEntry[] };
    return parsed.sent ?? [];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

async function remember(netId: string | undefined, entry: OutboxEntry): Promise<void> {
  if (!netId) return;
  const file = outboxFile(netId);
  const sent = await recentSends(netId);
  sent.unshift(entry);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify({ sent: sent.slice(0, 20) }, null, 2), "utf8");
}

export async function sendMorningEmail(input: {
  to: string;
  subject: string;
  text: string;
  netId?: string;
}): Promise<BriefSendResult> {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    const result: BriefSendResult = {
      transport: "outbox",
      to: input.to,
      subject: input.subject,
      accepted: true,
      detail: "SMTP_HOST is unset, so the brief was saved in the local outbox instead of being emailed.",
    };
    await remember(input.netId, { at: new Date().toISOString(), ...result });
    if (input.netId) {
      const copy = path.resolve(process.cwd(), "data", "briefs", safeNetId(input.netId), "latest.txt");
      await writeFile(copy, input.text, "utf8");
    }
    return result;
  }

  const transport = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
      : undefined,
  });
  const info = await transport.sendMail({
    from: process.env.SMTP_FROM ?? "yalehub@localhost",
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
  const result: BriefSendResult = {
    transport: "smtp",
    to: input.to,
    subject: input.subject,
    accepted: true,
    detail: info.response || info.messageId,
  };
  await remember(input.netId, { at: new Date().toISOString(), ...result });
  return result;
}

export async function describeBriefDelivery(netId: string, email: string | null): Promise<string> {
  const destination = email?.trim() || `${netId}@yale.edu`;
  const smtp = process.env.SMTP_HOST?.trim();
  const delivery = smtp
    ? `Mail goes out through ${smtp}.`
    : "SMTP_HOST is unset, so Send test email writes the local outbox (data/briefs) instead of a mailbox.";
  const sent = await recentSends(netId);
  const latest = sent[0];
  const last = latest
    ? `Last send: ${latest.at} to ${latest.to} via ${latest.transport}.`
    : "No brief has been sent yet.";
  return `Delivery address: ${destination}\n${delivery}\n${last}\nThe brief itself is the digest: calendar, dining, courses, and this inbox.`;
}
