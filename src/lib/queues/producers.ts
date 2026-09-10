import { Queue, type JobsOptions } from "bullmq";

import { requireQueueConnection, getQueueConnectionOptions } from "@/lib/queues/connection";
import { JOB_NAMES, QUEUE_NAMES } from "@/lib/queues/names";
import type { EmailMessage } from "@/lib/email/email-service";

export type EmailJobPayload = EmailMessage & {
  purpose:
    | "invitation"
    | "password-reset"
    | "email-verification"
    | "ticket-reply"
    | "generic";
  /** Deterministic idempotency key fragment */
  dedupeKey?: string;
};

export type ExpireInvitationJobPayload = {
  invitationId: string;
  organizationId: string;
};

export type TicketSlaScanPayload = {
  triggeredBy: "scheduler" | "manual";
};

export type IndexKnowledgeArticlePayload = {
  organizationId: string;
  articleId: string;
  action: "index" | "deindex";
};

declare global {
  var __ticketloomEmailQueue: Queue | undefined;
  var __ticketloomMaintenanceQueue: Queue | undefined;
  var __ticketloomKnowledgeIndexingQueue: Queue | undefined;
}

function defaultJobOptions(): JobsOptions {
  return {
    attempts: 5,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: { count: 200, age: 60 * 60 * 24 },
    removeOnFail: { count: 500, age: 60 * 60 * 24 * 7 },
  };
}

/**
 * BullMQ ≥5.76 rejects custom jobIds that contain `:` unless they match a
 * legacy 3-segment pattern. Prefer hyphenated ids for forward compatibility.
 */
function safeJobId(...parts: Array<string | number>): string {
  return parts
    .map((part) => String(part).replace(/:/g, "-"))
    .join("-");
}

export function getEmailQueue(): Queue | null {
  if (!getQueueConnectionOptions()) return null;
  if (!globalThis.__ticketloomEmailQueue) {
    globalThis.__ticketloomEmailQueue = new Queue(QUEUE_NAMES.email, {
      connection: requireQueueConnection(),
      defaultJobOptions: defaultJobOptions(),
    });
  }
  return globalThis.__ticketloomEmailQueue;
}

export function getMaintenanceQueue(): Queue | null {
  if (!getQueueConnectionOptions()) return null;
  if (!globalThis.__ticketloomMaintenanceQueue) {
    globalThis.__ticketloomMaintenanceQueue = new Queue(QUEUE_NAMES.maintenance, {
      connection: requireQueueConnection(),
      defaultJobOptions: defaultJobOptions(),
    });
  }
  return globalThis.__ticketloomMaintenanceQueue;
}

export function getKnowledgeIndexingQueue(): Queue | null {
  if (!getQueueConnectionOptions()) return null;
  if (!globalThis.__ticketloomKnowledgeIndexingQueue) {
    globalThis.__ticketloomKnowledgeIndexingQueue = new Queue(
      QUEUE_NAMES.knowledgeIndexing,
      {
        connection: requireQueueConnection(),
        defaultJobOptions: defaultJobOptions(),
      },
    );
  }
  return globalThis.__ticketloomKnowledgeIndexingQueue;
}

export class QueueUnavailableError extends Error {
  constructor(message = "Background job queue is unavailable. REDIS_URL is required.") {
    super(message);
    this.name = "QueueUnavailableError";
  }
}

export async function enqueueEmail(payload: EmailJobPayload): Promise<{ jobId: string }> {
  const queue = getEmailQueue();
  if (!queue) {
    throw new QueueUnavailableError(
      "Email could not be queued because Redis/BullMQ is unavailable.",
    );
  }

  const jobId = payload.dedupeKey
    ? safeJobId("email", payload.purpose, payload.dedupeKey)
    : undefined;

  const job = await queue.add(JOB_NAMES.sendEmail, payload, {
    jobId,
    attempts: 5,
    backoff: { type: "exponential", delay: 2_000 },
  });

  if (!job.id) {
    throw new QueueUnavailableError("Email job was not accepted by the queue.");
  }

  return { jobId: job.id };
}

export async function enqueueInvitationExpiry(params: {
  invitationId: string;
  organizationId: string;
  expiresAt: Date;
}): Promise<{ jobId: string } | null> {
  const queue = getMaintenanceQueue();
  if (!queue) return null;

  const delay = Math.max(0, params.expiresAt.getTime() - Date.now());
  const job = await queue.add(
    JOB_NAMES.expireInvitation,
    {
      invitationId: params.invitationId,
      organizationId: params.organizationId,
    } satisfies ExpireInvitationJobPayload,
    {
      jobId: safeJobId("invite-expire", params.invitationId),
      delay,
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: true,
    },
  );

  return job.id ? { jobId: job.id } : null;
}

export async function enqueueTicketSlaScan(
  triggeredBy: "scheduler" | "manual" = "manual",
): Promise<{ jobId: string }> {
  const queue = getMaintenanceQueue();
  if (!queue) {
    throw new QueueUnavailableError("SLA scan could not be queued.");
  }

  const job = await queue.add(
    JOB_NAMES.ticketSlaScan,
    { triggeredBy } satisfies TicketSlaScanPayload,
    {
      jobId:
        triggeredBy === "manual"
          ? safeJobId("sla-scan-manual", Date.now())
          : undefined,
      attempts: 3,
      backoff: { type: "fixed", delay: 10_000 },
    },
  );

  if (!job.id) throw new QueueUnavailableError("SLA job was not accepted.");
  return { jobId: job.id };
}

export async function enqueueKnowledgeIndex(params: {
  organizationId: string;
  articleId: string;
  action?: "index" | "deindex";
}): Promise<{ jobId: string } | null> {
  const queue = getKnowledgeIndexingQueue();
  if (!queue) return null;

  const action = params.action ?? "index";
  const job = await queue.add(
    JOB_NAMES.indexKnowledgeArticle,
    {
      organizationId: params.organizationId,
      articleId: params.articleId,
      action,
    } satisfies IndexKnowledgeArticlePayload,
    {
      jobId: safeJobId(
        "knowledge-index",
        action,
        params.organizationId,
        params.articleId,
      ),
      attempts: 4,
      backoff: { type: "exponential", delay: 3_000 },
      removeOnComplete: { count: 100, age: 60 * 60 * 24 },
    },
  );

  return job.id ? { jobId: job.id } : null;
}

export async function ensureRepeatableSlaJob(): Promise<void> {
  const queue = getMaintenanceQueue();
  if (!queue) return;

  await queue.add(
    JOB_NAMES.ticketSlaScan,
    { triggeredBy: "scheduler" } satisfies TicketSlaScanPayload,
    {
      repeat: { every: 5 * 60 * 1000 },
      jobId: "sla-scan-repeatable",
      attempts: 3,
      removeOnComplete: true,
    },
  );

  await queue.add(
    JOB_NAMES.knowledgeAnalyticsRollup,
    { triggeredBy: "scheduler" },
    {
      repeat: { every: 60 * 60 * 1000 },
      jobId: "knowledge-analytics-repeatable",
      attempts: 3,
      removeOnComplete: true,
    },
  );
}

export async function getQueueObservability() {
  const email = getEmailQueue();
  const maintenance = getMaintenanceQueue();
  const knowledgeIndexing = getKnowledgeIndexingQueue();
  if (!email || !maintenance) {
    return { available: false as const, reason: "REDIS_URL not configured" };
  }

  const [
    emailCounts,
    maintenanceCounts,
    indexingCounts,
    emailFailed,
    maintenanceFailed,
    indexingFailed,
  ] = await Promise.all([
    email.getJobCounts("waiting", "active", "completed", "failed", "delayed"),
    maintenance.getJobCounts("waiting", "active", "completed", "failed", "delayed"),
    knowledgeIndexing
      ? knowledgeIndexing.getJobCounts(
          "waiting",
          "active",
          "completed",
          "failed",
          "delayed",
        )
      : Promise.resolve(null),
    email.getJobs(["failed"], 0, 9),
    maintenance.getJobs(["failed"], 0, 9),
    knowledgeIndexing
      ? knowledgeIndexing.getJobs(["failed"], 0, 9)
      : Promise.resolve([]),
  ]);

  return {
    available: true as const,
    email: {
      name: QUEUE_NAMES.email,
      counts: emailCounts,
      recentFailed: emailFailed.map((job) => ({
        id: job.id,
        name: job.name,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason?.slice(0, 200) ?? null,
        timestamp: job.finishedOn ?? job.timestamp,
      })),
    },
    maintenance: {
      name: QUEUE_NAMES.maintenance,
      counts: maintenanceCounts,
      recentFailed: maintenanceFailed.map((job) => ({
        id: job.id,
        name: job.name,
        attemptsMade: job.attemptsMade,
        failedReason: job.failedReason?.slice(0, 200) ?? null,
        timestamp: job.finishedOn ?? job.timestamp,
      })),
    },
    knowledgeIndexing: knowledgeIndexing
      ? {
          name: QUEUE_NAMES.knowledgeIndexing,
          counts: indexingCounts,
          recentFailed: indexingFailed.map((job) => ({
            id: job.id,
            name: job.name,
            attemptsMade: job.attemptsMade,
            failedReason: job.failedReason?.slice(0, 200) ?? null,
            timestamp: job.finishedOn ?? job.timestamp,
          })),
        }
      : null,
  };
}
