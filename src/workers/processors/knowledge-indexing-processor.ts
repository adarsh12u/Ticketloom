import type { Job } from "bullmq";

import type { IndexKnowledgeArticlePayload } from "@/lib/queues/producers";
import { JOB_NAMES } from "@/lib/queues/names";
import { ragService } from "@/services/rag-service";

export async function processKnowledgeIndexingJob(job: Job) {
  if (job.name !== JOB_NAMES.indexKnowledgeArticle) {
    throw new Error(`Unknown knowledge indexing job: ${job.name}`);
  }

  const data = job.data as IndexKnowledgeArticlePayload;
  if (!data.organizationId || !data.articleId) {
    throw new Error("Invalid knowledge indexing payload.");
  }

  if (data.action === "deindex") {
    return ragService.deindexArticle(data.organizationId, data.articleId);
  }

  return ragService.indexArticleVersion(data.organizationId, data.articleId);
}
