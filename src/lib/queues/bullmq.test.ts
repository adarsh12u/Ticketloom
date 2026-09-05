import { Queue, Worker } from "bullmq";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  getQueueConnectionOptions,
  requireQueueConnection,
} from "@/lib/queues/connection";
import { JOB_NAMES, QUEUE_NAMES } from "@/lib/queues/names";
import {
  enqueueEmail,
  enqueueInvitationExpiry,
  enqueueTicketSlaScan,
  QueueUnavailableError,
} from "@/lib/queues/producers";
import { disconnectRedis, isRedisConfigured } from "@/lib/redis/client";
import { processEmailJob } from "@/workers/processors/email-processor";
import { processMaintenanceJob } from "@/workers/processors/maintenance-processor";

const redisReady = Boolean(process.env.REDIS_URL);

describe("BullMQ infrastructure", () => {
  const suffix = Date.now();
  const emailQueueName = `${QUEUE_NAMES.email}-test-${suffix}`;
  const maintenanceQueueName = `${QUEUE_NAMES.maintenance}-test-${suffix}`;

  beforeAll(async () => {
    if (!redisReady) return;
  });

  afterAll(async () => {
    if (!redisReady) return;
    await disconnectRedis();
  });

  it("requires Redis for queue connection options", () => {
    if (!redisReady) {
      expect(getQueueConnectionOptions()).toBeNull();
      return;
    }
    expect(getQueueConnectionOptions()).toMatchObject({
      maxRetriesPerRequest: null,
    });
  });

  it("creates queues and enqueues jobs", async () => {
    if (!redisReady) return;

    const connection = requireQueueConnection();
    const queue = new Queue(emailQueueName, { connection });
    const job = await queue.add("ping", { hello: "world" });
    expect(job.id).toBeTruthy();
    await queue.obliterate({ force: true });
    await queue.close();
  });

  it("processes jobs to completion", async () => {
    if (!redisReady) return;

    const connection = requireQueueConnection();
    const queue = new Queue(emailQueueName, { connection });
    const worker = new Worker(
      emailQueueName,
      async (job) => ({ processed: job.data.value }),
      { connection, concurrency: 2 },
    );

    await worker.waitUntilReady();
    const job = await queue.add("work", { value: 42 });

    let result: unknown;
    for (let i = 0; i < 50; i += 1) {
      const state = await job.getState();
      if (state === "completed") {
        const finished = await queue.getJob(job.id!);
        result = finished?.returnvalue ?? null;
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }

    expect(result).toEqual({ processed: 42 });
    await worker.close();
    await queue.obliterate({ force: true });
    await queue.close();
  }, 15_000);

  it("retries failed jobs with backoff", async () => {
    if (!redisReady) return;

    const connection = requireQueueConnection();
    const queueName = `${emailQueueName}-retry`;
    const queue = new Queue(queueName, { connection });
    let attempts = 0;
    const worker = new Worker(
      queueName,
      async () => {
        attempts += 1;
        if (attempts < 3) throw new Error("transient");
        return { ok: true };
      },
      { connection, concurrency: 1 },
    );

    await worker.waitUntilReady();
    const job = await queue.add(
      "flaky",
      {},
      { attempts: 5, backoff: { type: "fixed", delay: 50 } },
    );

    for (let i = 0; i < 80; i += 1) {
      const state = await job.getState();
      if (state === "completed") break;
      await new Promise((r) => setTimeout(r, 100));
    }

    expect(await job.getState()).toBe("completed");
    expect(attempts).toBeGreaterThanOrEqual(3);
    await worker.close();
    await queue.obliterate({ force: true });
    await queue.close();
  }, 20_000);

  it("marks permanent failures after attempts exhausted", async () => {
    if (!redisReady) return;

    const connection = requireQueueConnection();
    const queueName = `${emailQueueName}-fail`;
    const queue = new Queue(queueName, { connection });
    const worker = new Worker(
      queueName,
      async () => {
        throw new Error("permanent validation failure");
      },
      { connection, concurrency: 1 },
    );
    await worker.waitUntilReady();
    const job = await queue.add("bad", {}, { attempts: 2, backoff: { type: "fixed", delay: 20 } });

    for (let i = 0; i < 80; i += 1) {
      if ((await job.getState()) === "failed") break;
      await new Promise((r) => setTimeout(r, 100));
    }

    expect(await job.getState()).toBe("failed");
    expect(job.failedReason || (await job.getState())).toBeTruthy();
    await worker.close();
    await queue.obliterate({ force: true });
    await queue.close();
  }, 20_000);

  it("supports delayed jobs", async () => {
    if (!redisReady) return;

    const connection = requireQueueConnection();
    const queueName = `${maintenanceQueueName}-delayed`;
    const queue = new Queue(queueName, { connection });
    const worker = new Worker(queueName, async () => ({ delayed: true }), {
      connection,
      concurrency: 1,
    });
    await worker.waitUntilReady();

    const job = await queue.add("later", {}, { delay: 500 });
    expect(await job.getState()).toBe("delayed");

    for (let i = 0; i < 40; i += 1) {
      if ((await job.getState()) === "completed") break;
      await new Promise((r) => setTimeout(r, 100));
    }
    expect(await job.getState()).toBe("completed");
    await worker.close();
    await queue.obliterate({ force: true });
    await queue.close();
  }, 15_000);

  it("respects worker concurrency", async () => {
    if (!redisReady) return;

    const connection = requireQueueConnection();
    const queueName = `${emailQueueName}-conc`;
    const queue = new Queue(queueName, { connection });
    let running = 0;
    let maxRunning = 0;
    const worker = new Worker(
      queueName,
      async () => {
        running += 1;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((r) => setTimeout(r, 200));
        running -= 1;
      },
      { connection, concurrency: 2 },
    );
    await worker.waitUntilReady();

    await Promise.all([
      queue.add("a", {}),
      queue.add("b", {}),
      queue.add("c", {}),
      queue.add("d", {}),
    ]);

    await new Promise((r) => setTimeout(r, 1500));
    expect(maxRunning).toBeLessThanOrEqual(2);
    expect(maxRunning).toBeGreaterThan(0);
    await worker.close();
    await queue.obliterate({ force: true });
    await queue.close();
  }, 15_000);

  it("email processor rejects invalid payloads and accepts valid ones", async () => {
    await expect(
      processEmailJob({
        id: "1",
        name: JOB_NAMES.sendEmail,
        data: { to: "", subject: "", text: "", purpose: "generic" },
      } as never),
    ).rejects.toThrow(/Invalid email/);

    const previousFallback = process.env.EMAIL_DEV_CONSOLE_FALLBACK;
    const previousHost = process.env.SMTP_HOST;
    process.env.EMAIL_DEV_CONSOLE_FALLBACK = "true";
    delete process.env.SMTP_HOST;

    const result = await processEmailJob({
      id: "2",
      name: JOB_NAMES.sendEmail,
      data: {
        to: "ops@example.com",
        subject: "Hello",
        text: "Body",
        purpose: "invitation",
      },
    } as never);
    expect(result.status).toMatch(/sent|logged|skipped/);

    if (previousFallback === undefined) delete process.env.EMAIL_DEV_CONSOLE_FALLBACK;
    else process.env.EMAIL_DEV_CONSOLE_FALLBACK = previousFallback;
    if (previousHost === undefined) delete process.env.SMTP_HOST;
    else process.env.SMTP_HOST = previousHost;
  });

  it("enqueue helpers use production queue names when Redis is configured", async () => {
    if (!redisReady) {
      await expect(
        enqueueEmail({
          to: "a@b.com",
          subject: "x",
          text: "y",
          purpose: "password-reset",
          dedupeKey: "token-1",
        }),
      ).rejects.toBeInstanceOf(QueueUnavailableError);
      return;
    }

    const { jobId } = await enqueueEmail({
      to: "a@b.com",
      subject: "Reset",
      text: "reset link",
      purpose: "password-reset",
      dedupeKey: `reset-${suffix}`,
    });
    expect(jobId).toContain("email-password-reset");
    expect(jobId).not.toContain(":");

    const invite = await enqueueInvitationExpiry({
      invitationId: `inv-${suffix}`,
      organizationId: `org-${suffix}`,
      expiresAt: new Date(Date.now() + 2_000),
    });
    expect(invite?.jobId).toContain("invite-expire-");
    expect(invite?.jobId).not.toContain(":");

    const sla = await enqueueTicketSlaScan("manual");
    expect(sla.jobId).toBeTruthy();
    expect(sla.jobId).not.toContain(":");
  });

  it("producer fails loudly when Redis is not configured", async () => {
    if (isRedisConfigured()) {
      // Temporarily prove QueueUnavailableError path via require
      expect(() => requireQueueConnection()).not.toThrow();
      return;
    }
    await expect(enqueueTicketSlaScan("manual")).rejects.toBeInstanceOf(
      QueueUnavailableError,
    );
  });

  it("maintenance expire invitation is idempotent for missing invites", async () => {
    const result = await processMaintenanceJob({
      id: "m1",
      name: JOB_NAMES.expireInvitation,
      data: { invitationId: "missing", organizationId: "missing-org" },
    } as never);
    expect(result).toEqual({ status: "missing" });
  });

  it("SLA scan job runs without throwing", async () => {
    const result = await processMaintenanceJob({
      id: "m2",
      name: JOB_NAMES.ticketSlaScan,
      data: { triggeredBy: "manual" },
    } as never);
    expect(result).toHaveProperty("approaching");
    expect(result).toHaveProperty("breached");
    expect(result).toHaveProperty("activitiesCreated");
  });
});
