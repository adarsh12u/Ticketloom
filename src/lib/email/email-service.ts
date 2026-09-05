import nodemailer from "nodemailer";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type SendEmailResult =
  | { status: "sent"; provider: "smtp" }
  | { status: "logged"; provider: "console" }
  | { status: "failed"; provider: "smtp" | "console"; reason: string }
  | { status: "unconfigured"; provider: "none" };

export interface EmailProvider {
  send(message: EmailMessage): Promise<SendEmailResult>;
}

function isSmtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASSWORD &&
      process.env.EMAIL_FROM,
  );
}

async function sendViaConsole(message: EmailMessage): Promise<SendEmailResult> {
  // Local fallback — do not print full bodies (may contain one-time links).
  console.info("[email:console]", {
    to: message.to,
    subject: message.subject,
    delivered: "console",
  });
  return { status: "logged", provider: "console" };
}

class ConsoleEmailProvider implements EmailProvider {
  send(message: EmailMessage) {
    return sendViaConsole(message);
  }
}

class SmtpEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<SendEmailResult> {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASSWORD;
    const from = process.env.EMAIL_FROM;

    if (!host || !port || !user || !pass || !from) {
      return { status: "unconfigured", provider: "none" };
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });

    await transporter.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    console.info("[email:smtp]", {
      to: message.to,
      subject: message.subject,
      status: "sent",
    });

    return { status: "sent", provider: "smtp" };
  }
}

export function getEmailProvider(): EmailProvider {
  if (isSmtpConfigured()) {
    return new SmtpEmailProvider();
  }

  // Production fails closed unless an explicit console escape hatch is set.
  // Local / EMAIL_ALLOW_CONSOLE=true may use console logging (never prints bodies).
  if (isProductionEmailStrict()) {
    return {
      async send() {
        return { status: "unconfigured", provider: "none" };
      },
    };
  }

  return new ConsoleEmailProvider();
}

function isProductionEmailStrict() {
  if (process.env.EMAIL_ALLOW_CONSOLE === "true") return false;
  if (process.env.EMAIL_REQUIRED === "false") return false;
  if (process.env.NODE_ENV === "production") return true;
  // Legacy opt-in still honored
  return process.env.EMAIL_REQUIRED === "true";
}

function allowDevEmailFallback() {
  if (process.env.EMAIL_DEV_CONSOLE_FALLBACK === "true") return true;
  if (process.env.EMAIL_ALLOW_CONSOLE === "true") return true;
  if (process.env.NODE_ENV !== "production") return true;
  const url = process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  return url.includes("localhost") || url.includes("127.0.0.1");
}

export async function sendEmail(message: EmailMessage): Promise<SendEmailResult> {
  const provider = getEmailProvider();
  try {
    const result = await provider.send(message);

    if (result.status === "failed" && result.provider === "smtp" && allowDevEmailFallback()) {
      console.info("[email] SMTP failed in local development; using console fallback", {
        reason: result.reason,
      });
      return sendViaConsole(message);
    }

    return result;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    console.error("[email] failed to send message", {
      to: message.to,
      subject: message.subject,
      error: reason,
    });

    if (isSmtpConfigured() && allowDevEmailFallback()) {
      console.info("[email] SMTP exception in local development; using console fallback");
      return sendViaConsole(message);
    }

    return {
      status: "failed",
      provider: isSmtpConfigured() ? "smtp" : "console",
      reason,
    };
  }
}

export function getEmailProviderName(): "smtp" | "console" | "none" {
  if (isSmtpConfigured()) return "smtp";
  if (isProductionEmailStrict()) return "none";
  return "console";
}
