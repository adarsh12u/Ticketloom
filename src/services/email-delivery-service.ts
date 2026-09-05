import { sendEmail, type EmailMessage } from "@/lib/email/email-service";
import { isRedisConfigured } from "@/lib/redis/client";
import {
  enqueueEmail,
  QueueUnavailableError,
  type EmailJobPayload,
} from "@/lib/queues/producers";

export type DeliverEmailResult =
  | { mode: "queued"; jobId: string }
  | { mode: "sync"; status: string };

/**
 * Prefer BullMQ when Redis is configured.
 * If REDIS_URL is unset (local/dev), send synchronously so the app remains usable.
 * If REDIS_URL is set but the queue is down, fail loudly — never pretend a job was queued.
 */
export async function deliverEmail(
  message: EmailMessage,
  options: {
    purpose: EmailJobPayload["purpose"];
    dedupeKey?: string;
  },
): Promise<DeliverEmailResult> {
  if (!isRedisConfigured()) {
    const result = await sendEmail(message);
    if (result.status === "failed" || result.status === "unconfigured") {
      throw new Error(
        result.status === "failed"
          ? result.reason
          : "Email service is not configured.",
      );
    }
    return { mode: "sync", status: result.status };
  }

  try {
    const { jobId } = await enqueueEmail({
      ...message,
      purpose: options.purpose,
      dedupeKey: options.dedupeKey,
    });
    return { mode: "queued", jobId };
  } catch (error) {
    if (error instanceof QueueUnavailableError) {
      throw error;
    }
    throw new QueueUnavailableError(
      error instanceof Error ? error.message : "Unable to enqueue email job.",
    );
  }
}
