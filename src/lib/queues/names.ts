export const QUEUE_NAMES = {
  email: "ticketloom-email",
  maintenance: "ticketloom-maintenance",
  knowledgeIndexing: "ticketloom-knowledge-indexing",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const JOB_NAMES = {
  sendEmail: "send-email",
  expireInvitation: "expire-invitation",
  ticketSlaScan: "ticket-sla-scan",
  knowledgeAnalyticsRollup: "knowledge-analytics-rollup",
  indexKnowledgeArticle: "index-knowledge-article",
} as const;
