import type { Job } from "bullmq";

import { prisma } from "@/lib/db/prisma";
import type {
  ExpireInvitationJobPayload,
  TicketSlaScanPayload,
} from "@/lib/queues/producers";
import { JOB_NAMES } from "@/lib/queues/names";

async function processExpireInvitation(job: Job<ExpireInvitationJobPayload>) {
  const { invitationId, organizationId } = job.data;
  const invitation = await prisma.organizationInvitation.findFirst({
    where: { id: invitationId, organizationId },
  });

  if (!invitation) {
    return { status: "missing" as const };
  }

  if (invitation.status !== "PENDING") {
    return { status: "already-finalized" as const, current: invitation.status };
  }

  if (invitation.expiresAt.getTime() > Date.now()) {
    return { status: "not-yet-expired" as const };
  }

  await prisma.organizationInvitation.updateMany({
    where: {
      id: invitationId,
      organizationId,
      status: "PENDING",
    },
    data: { status: "EXPIRED" },
  });

  return { status: "expired" as const };
}

/**
 * SLA scan — idempotent via unique activity metadata marker per ticket+type+day.
 */
async function processTicketSlaScan(job: Job<TicketSlaScanPayload>) {
  void job;
  const now = new Date();
  const soon = new Date(now.getTime() + 60 * 60 * 1000);

  const approaching = await prisma.ticket.findMany({
    where: {
      archivedAt: null,
      status: { in: ["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER"] },
      OR: [
        {
          firstResponseDueAt: { lte: soon, gt: now },
          firstRespondedAt: null,
        },
        {
          resolutionDueAt: { lte: soon, gt: now },
          resolvedAt: null,
          closedAt: null,
        },
      ],
    },
    select: {
      id: true,
      organizationId: true,
      numberKey: true,
      firstResponseDueAt: true,
      resolutionDueAt: true,
      firstRespondedAt: true,
      resolvedAt: true,
    },
    take: 200,
  });

  const breached = await prisma.ticket.findMany({
    where: {
      archivedAt: null,
      status: { in: ["OPEN", "IN_PROGRESS", "WAITING_ON_CUSTOMER"] },
      OR: [
        {
          firstResponseDueAt: { lt: now },
          firstRespondedAt: null,
        },
        {
          resolutionDueAt: { lt: now },
          resolvedAt: null,
          closedAt: null,
        },
      ],
    },
    select: {
      id: true,
      organizationId: true,
      numberKey: true,
      firstResponseDueAt: true,
      resolutionDueAt: true,
      firstRespondedAt: true,
      resolvedAt: true,
    },
    take: 200,
  });

  let created = 0;
  const dayKey = now.toISOString().slice(0, 10);

  for (const ticket of approaching) {
    const marker = `sla-approaching:${ticket.id}:${dayKey}`;
    const existing = await prisma.ticketActivity.findFirst({
      where: {
        ticketId: ticket.id,
        organizationId: ticket.organizationId,
        type: "UPDATED",
        message: "SLA deadline approaching",
        metadata: { path: ["marker"], equals: marker },
      },
    });
    if (existing) continue;

    await prisma.ticketActivity.create({
      data: {
        organizationId: ticket.organizationId,
        ticketId: ticket.id,
        actorId: null,
        type: "UPDATED",
        message: "SLA deadline approaching",
        metadata: {
          marker,
          numberKey: ticket.numberKey,
          firstResponseDueAt: ticket.firstResponseDueAt,
          resolutionDueAt: ticket.resolutionDueAt,
        },
      },
    });
    created += 1;
  }

  for (const ticket of breached) {
    const marker = `sla-breached:${ticket.id}:${dayKey}`;
    const existing = await prisma.ticketActivity.findFirst({
      where: {
        ticketId: ticket.id,
        organizationId: ticket.organizationId,
        type: "UPDATED",
        message: "SLA deadline breached",
        metadata: { path: ["marker"], equals: marker },
      },
    });
    if (existing) continue;

    await prisma.ticketActivity.create({
      data: {
        organizationId: ticket.organizationId,
        ticketId: ticket.id,
        actorId: null,
        type: "UPDATED",
        message: "SLA deadline breached",
        metadata: {
          marker,
          numberKey: ticket.numberKey,
          firstResponseDueAt: ticket.firstResponseDueAt,
          resolutionDueAt: ticket.resolutionDueAt,
        },
      },
    });
    created += 1;
  }

  return {
    approaching: approaching.length,
    breached: breached.length,
    activitiesCreated: created,
  };
}

/**
 * Reconcile denormalized knowledge view counts and prune stale search events.
 * Idempotent — safe to retry.
 */
async function processKnowledgeAnalyticsRollup() {
  const articles = await prisma.knowledgeArticle.findMany({
    where: { status: "PUBLISHED" },
    select: { id: true, organizationId: true },
    take: 500,
    orderBy: { updatedAt: "desc" },
  });

  let updated = 0;
  for (const article of articles) {
    const count = await prisma.knowledgeArticleView.count({
      where: { articleId: article.id, organizationId: article.organizationId },
    });
    await prisma.knowledgeArticle.updateMany({
      where: { id: article.id, organizationId: article.organizationId },
      data: { viewCount: count },
    });
    updated += 1;
  }

  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const pruned = await prisma.knowledgeSearchEvent.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  return { articlesReconciled: updated, searchEventsPruned: pruned.count };
}

export async function processMaintenanceJob(job: Job) {
  switch (job.name) {
    case JOB_NAMES.expireInvitation:
      return processExpireInvitation(job as Job<ExpireInvitationJobPayload>);
    case JOB_NAMES.ticketSlaScan:
      return processTicketSlaScan(job as Job<TicketSlaScanPayload>);
    case JOB_NAMES.knowledgeAnalyticsRollup:
      return processKnowledgeAnalyticsRollup();
    default:
      throw new Error(`Unknown maintenance job: ${job.name}`);
  }
}
