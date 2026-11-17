import { searchYaleKnowledge } from "../../integrations/vector-db.js";
import type { RetrievedChunk } from "../types.js";

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  /** Set when the index could not be queried. The agent still answers and says so. */
  warning?: string;
}

/**
 * Retrieval entry the agent calls before every answer.
 * Wraps the existing Yale text-chunk vector database.
 */
export async function retrieveYaleKnowledge(query: string, k = 5): Promise<RetrievalResult> {
  try {
    const chunks = await searchYaleKnowledge(query, k);
    return { chunks };
  } catch (err) {
    const warning = err instanceof Error ? err.message : String(err);
    return { chunks: [], warning };
  }
}
