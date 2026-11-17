import nodemailer from "nodemailer";

/**
 * Aiden owns morning-email delivery.
 * With SMTP_HOST unset, sendMorningEmail records a stub send so the dashboard button works offline.
 */

export interface BriefSendResult {
  transport: "stub" | "smtp";
  to: string;
  subject: string;
  accepted: boolean;
  detail: string;
}

export async function sendMorningEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<BriefSendResult> {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) {
    return {
      transport: "stub",
      to: input.to,
      subject: input.subject,
      accepted: true,
      detail: "TODO(aiden): SMTP_HOST is unset, so this was a stub send. Wire Nodemailer or Gmail here.",
    };
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
  return {
    transport: "smtp",
    to: input.to,
    subject: input.subject,
    accepted: true,
    detail: info.response || info.messageId,
  };
}
