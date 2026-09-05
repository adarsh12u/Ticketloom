import type { Job } from "bullmq";

import { sendEmail } from "@/lib/email/email-service";
import type { EmailJobPayload } from "@/lib/queues/producers";

/**
 * Email processor — idempotent with respect to side effects:
 * - Does not mutate memberships/users.
 * - Deterministic job IDs prevent duplicate queued work for the same intent.
 * - Re-sending the same email on retry is acceptable (better than silent loss).
 */
export async function processEmailJob(job: Job<EmailJobPayload>) {
  const { to, subject, text, html, purpose } = job.data;
  if (!to || !subject || !text) {
    throw new Error("Invalid email job payload.");
  }

  const result = await sendEmail({ to, subject, text, html });
  if (result.status === "failed" || result.status === "unconfigured") {
    throw new Error(
      `Email send failed (${purpose}): ${result.status === "failed" ? result.reason : "unconfigured"}`,
    );
  }

  return {
    status: result.status,
    provider: result.provider,
    purpose,
  };
}
