import { randomUUID } from "node:crypto";

import type {
  AiFeature,
  AiSuggestionEventType,
  AiUsageStatus,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";

export type CreateAiUsageEventInput = {
  organizationId: string;
  userId?: string | null;
  feature: AiFeature;
  provider: string;
  model?: string | null;
  status: AiUsageStatus;
  latencyMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  retrievedSourcesCount?: number | null;
  errorCode?: string | null;
  suggestionId?: string | null;
};

export const aiUsageRepository = {
  newSuggestionId() {
    return randomUUID().replace(/-/g, "").slice(0, 24);
  },

  async createUsageEvent(input: CreateAiUsageEventInput) {
    return prisma.aiUsageEvent.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId ?? null,
        feature: input.feature,
        provider: input.provider,
        model: input.model ?? null,
        status: input.status,
        latencyMs: input.latencyMs ?? null,
        inputTokens: input.inputTokens ?? null,
        outputTokens: input.outputTokens ?? null,
        retrievedSourcesCount: input.retrievedSourcesCount ?? null,
        errorCode: input.errorCode ?? null,
        suggestionId: input.suggestionId ?? null,
      },
    });
  },

  async createSuggestionEvent(input: {
    organizationId: string;
    userId: string;
    suggestionId: string;
    feature: AiFeature;
    eventType: AiSuggestionEventType;
  }) {
    return prisma.aiSuggestionEvent.create({
      data: input,
    });
  },

  async aggregateUsage(organizationId: string, from: Date, to: Date) {
    const [byStatus, byFeature, latency, suggestionEvents, ragEvents] =
      await Promise.all([
        prisma.aiUsageEvent.groupBy({
          by: ["status"],
          where: {
            organizationId,
            createdAt: { gte: from, lte: to },
          },
          _count: { _all: true },
        }),
        prisma.aiUsageEvent.groupBy({
          by: ["feature"],
          where: {
            organizationId,
            createdAt: { gte: from, lte: to },
          },
          _count: { _all: true },
        }),
        prisma.aiUsageEvent.aggregate({
          where: {
            organizationId,
            createdAt: { gte: from, lte: to },
            latencyMs: { not: null },
            status: "SUCCESS",
          },
          _avg: { latencyMs: true },
          _count: { _all: true },
        }),
        prisma.aiSuggestionEvent.groupBy({
          by: ["eventType"],
          where: {
            organizationId,
            createdAt: { gte: from, lte: to },
          },
          _count: { _all: true },
        }),
        prisma.ragRetrievalEvent.aggregate({
          where: {
            organizationId,
            createdAt: { gte: from, lte: to },
          },
          _count: { _all: true },
          _avg: { latencyMs: true },
        }),
      ]);

    const statusCounts = Object.fromEntries(
      byStatus.map((row) => [row.status, row._count._all]),
    ) as Record<string, number>;
    const total =
      (statusCounts.SUCCESS ?? 0) +
      (statusCounts.FAILURE ?? 0) +
      (statusCounts.UNAVAILABLE ?? 0);
    const success = statusCounts.SUCCESS ?? 0;

    const suggestionCounts = Object.fromEntries(
      suggestionEvents.map((row) => [row.eventType, row._count._all]),
    ) as Record<string, number>;

    const generated = suggestionCounts.GENERATED ?? 0;
    const inserted = suggestionCounts.INSERTED ?? 0;
    const edited = suggestionCounts.EDITED ?? 0;
    const sent = suggestionCounts.SENT ?? 0;
    const helpful = suggestionCounts.FEEDBACK_HELPFUL ?? 0;
    const notHelpful = suggestionCounts.FEEDBACK_NOT_HELPFUL ?? 0;
    const feedbackTotal = helpful + notHelpful;

    return {
      requests: total,
      successRate: total > 0 ? success / total : 0,
      avgLatencyMs: latency._avg.latencyMs ?? null,
      byFeature: byFeature.map((row) => ({
        feature: row.feature,
        count: row._count._all,
      })),
      rag: {
        retrievals: ragEvents._count._all,
        avgLatencyMs: ragEvents._avg.latencyMs ?? null,
      },
      acceptance: {
        generated,
        inserted,
        edited,
        sent,
        insertedRate: generated > 0 ? inserted / generated : 0,
        editedRate: generated > 0 ? edited / generated : 0,
        sentRate: generated > 0 ? sent / generated : 0,
      },
      feedback: {
        helpful,
        notHelpful,
        helpfulRate: feedbackTotal > 0 ? helpful / feedbackTotal : 0,
      },
    };
  },

  async dailyUsageCounts(organizationId: string, from: Date, to: Date) {
    const rows = await prisma.$queryRaw<
      Array<{ day: Date; count: bigint; success: bigint }>
    >`
      SELECT
        date_trunc('day', created_at) AS day,
        COUNT(*)::bigint AS count,
        COUNT(*) FILTER (WHERE status = 'SUCCESS')::bigint AS success
      FROM ai_usage_events
      WHERE organization_id = ${organizationId}
        AND created_at >= ${from}
        AND created_at <= ${to}
      GROUP BY 1
      ORDER BY 1 ASC
    `;
    return rows.map((row) => ({
      day: row.day.toISOString().slice(0, 10),
      count: Number(row.count),
      success: Number(row.success),
    }));
  },
};

export type AiUsageAggregate = Awaited<
  ReturnType<typeof aiUsageRepository.aggregateUsage>
>;

export type PrismaAiUsageCreate = Prisma.AiUsageEventCreateInput;
