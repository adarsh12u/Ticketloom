import "dotenv/config";

import { Worker } from "bullmq";

import { requireServerEnv } from "@/lib/env";
import { requireQueueConnection } from "@/lib/queues/connection";
import { QUEUE_NAMES } from "@/lib/queues/names";
import { ensureRepeatableSlaJob } from "@/lib/queues/producers";
import { processEmailJob } from "@/workers/processors/email-processor";
import { processKnowledgeIndexingJob } from "@/workers/processors/knowledge-indexing-processor";
import { processMaintenanceJob } from "@/workers/processors/maintenance-processor";

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SKIP_ENV_VALIDATION !== "true") {
    requireServerEnv();
  }

  if (!process.env.REDIS_URL) {
    console.error("[worker] REDIS_URL is required");
    process.exit(1);
  }

  const connection = requireQueueConnection();

  const emailWorker = new Worker(QUEUE_NAMES.email, processEmailJob, {
    connection,
    concurrency: 5,
  });

  const maintenanceWorker = new Worker(QUEUE_NAMES.maintenance, processMaintenanceJob, {
    connection,
    concurrency: 2,
  });

  const knowledgeIndexingWorker = new Worker(
    QUEUE_NAMES.knowledgeIndexing,
    processKnowledgeIndexingJob,
    {
      connection,
      concurrency: 2,
    },
  );

  for (const worker of [emailWorker, maintenanceWorker, knowledgeIndexingWorker]) {
    worker.on("completed", (job) => {
      console.info("[worker] completed", {
        queue: worker.name,
        jobId: job.id,
        name: job.name,
      });
    });
    worker.on("failed", (job, error) => {
      console.error("[worker] failed", {
        queue: worker.name,
        jobId: job?.id,
        name: job?.name,
        attemptsMade: job?.attemptsMade,
        error: error.message,
      });
    });
  }

  await ensureRepeatableSlaJob();
  console.info("[worker] Ticketloom workers started", {
    email: QUEUE_NAMES.email,
    maintenance: QUEUE_NAMES.maintenance,
    knowledgeIndexing: QUEUE_NAMES.knowledgeIndexing,
  });

  const shutdown = async (signal: string) => {
    console.info(`[worker] shutting down (${signal})`);
    await Promise.all([
      emailWorker.close(),
      maintenanceWorker.close(),
      knowledgeIndexingWorker.close(),
    ]);
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error("[worker] fatal", error instanceof Error ? error.message : error);
  process.exit(1);
});
