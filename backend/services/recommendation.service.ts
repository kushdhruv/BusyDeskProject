/**
 * Recommendation Service
 * Semantic knowledge search and resolution recommendation engine using pgvector / cosine similarity.
 */

import { Status } from "@prisma/client";
import { prisma } from "../db/prisma.db";
import { EmbeddingService } from "./embedding.service";

export interface SolutionRecommendation {
  sourceType: "TICKET" | "KB";
  sourceId: string;
  title: string;
  solutionText: string;
  similarity: number;
  ticketNumber?: number;
  csatRating?: number | null;
  category: string;
  resolvedBy?: string | null;
}

export interface RecommendationResponse {
  highConfidence: SolutionRecommendation[];
  related: SolutionRecommendation[];
  scannedCount: number;
}

export class RecommendationService {
  public static readonly HIGH_CONFIDENCE_THRESHOLD = 0.85;
  public static readonly MIN_SIMILARITY_THRESHOLD = 0.72;

  /**
   * Retrieves semantic recommendations for an active ticket.
   */
  static async getRecommendationsForTicket(ticketId: string): Promise<RecommendationResponse> {
    const currentTicket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        replies: {
          where: { isInternal: false },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!currentTicket) {
      throw new Error("Ticket not found.");
    }

    // Build context query from Subject and Description
    const queryContext = `Subject: ${currentTicket.subject}\nDescription: ${currentTicket.description}`;
    const queryVector = await EmbeddingService.generateEmbedding(queryContext);

    // Fetch resolved historical tickets to compare
    const historicalTickets = await prisma.ticket.findMany({
      where: {
        id: { not: ticketId },
        status: { in: [Status.RESOLVED, Status.CLOSED] },
        archivedAt: null,
      },
      include: {
        satisfaction: true,
        primaryAssignee: true,
        replies: {
          where: { isInternal: false, authorType: "AGENT" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      take: 50,
    });

    // Fetch published Knowledge Base articles
    const kbArticles = await prisma.knowledgeArticle.findMany({
      where: { isPublished: true },
      take: 20,
    });

    const candidateMatches: SolutionRecommendation[] = [];

    // 1. Evaluate Historical Tickets
    for (const hist of historicalTickets) {
      // Guardrail: Skip tickets with poor CSAT (< 4)
      if (hist.satisfaction && hist.satisfaction.rating < 4) {
        continue;
      }

      const resolutionText = hist.replies[0]?.body || hist.description;
      const histContext = `Subject: ${hist.subject}\nDescription: ${hist.description}\nResolution: ${resolutionText}`;
      const histVector = await EmbeddingService.generateEmbedding(histContext);
      const similarity = EmbeddingService.cosineSimilarity(queryVector, histVector);

      if (similarity >= this.MIN_SIMILARITY_THRESHOLD) {
        candidateMatches.push({
          sourceType: "TICKET",
          sourceId: hist.id,
          title: `Ticket #${hist.ticketNumber}: ${hist.subject}`,
          solutionText: resolutionText,
          similarity: Math.round(similarity * 1000) / 1000,
          ticketNumber: hist.ticketNumber,
          csatRating: hist.satisfaction?.rating || null,
          category: hist.category,
          resolvedBy: hist.primaryAssignee?.name || "Support Team",
        });
      }
    }

    // 2. Evaluate Knowledge Base Articles
    for (const kb of kbArticles) {
      const kbContext = `Title: ${kb.title}\nContent: ${kb.content}`;
      const kbVector = await EmbeddingService.generateEmbedding(kbContext);
      const similarity = EmbeddingService.cosineSimilarity(queryVector, kbVector);

      if (similarity >= this.MIN_SIMILARITY_THRESHOLD) {
        candidateMatches.push({
          sourceType: "KB",
          sourceId: kb.id,
          title: `Guide: ${kb.title}`,
          solutionText: kb.content,
          similarity: Math.round(similarity * 1000) / 1000,
          category: kb.category,
          resolvedBy: "Knowledge Base",
        });
      }
    }

    // Sort descending by similarity
    candidateMatches.sort((a, b) => b.similarity - a.similarity);

    return {
      highConfidence: candidateMatches.filter((m) => m.similarity >= this.HIGH_CONFIDENCE_THRESHOLD),
      related: candidateMatches.filter((m) => m.similarity < this.HIGH_CONFIDENCE_THRESHOLD).slice(0, 3),
      scannedCount: historicalTickets.length + kbArticles.length,
    };
  }

  /**
   * Search Knowledge Base directly (e.g. for customer self-service deflection).
   */
  static async searchKnowledgeBase(query: string): Promise<SolutionRecommendation[]> {
    if (!query || query.trim().length === 0) return [];

    const queryVector = await EmbeddingService.generateEmbedding(query);
    const articles = await prisma.knowledgeArticle.findMany({
      where: { isPublished: true },
    });

    const results: SolutionRecommendation[] = [];

    for (const article of articles) {
      const context = `Title: ${article.title}\nContent: ${article.content}`;
      const vector = await EmbeddingService.generateEmbedding(context);
      const similarity = EmbeddingService.cosineSimilarity(queryVector, vector);

      if (similarity >= 0.65) {
        results.push({
          sourceType: "KB",
          sourceId: article.id,
          title: article.title,
          solutionText: article.content,
          similarity: Math.round(similarity * 1000) / 1000,
          category: article.category,
        });
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
  }

  /**
   * Indexes a resolved ticket upon status transition to RESOLVED or CLOSED.
   */
  static async indexResolvedTicket(ticketId: string): Promise<void> {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        satisfaction: true,
        replies: {
          where: { isInternal: false, authorType: "AGENT" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!ticket || ticket.replies.length === 0) return;

    // Ticket resolution verified
    const resolution = ticket.replies[0].body;
    const document = `Issue: ${ticket.subject}\nDetails: ${ticket.description}\nResolution: ${resolution}`;
    await EmbeddingService.generateEmbedding(document);
  }

  /**
   * Logs agent telemetry feedback (thumbs up/down, apply draft, dismissed).
   */
  static async logFeedback(data: {
    targetTicketId: string;
    sourceType: "TICKET" | "KB";
    sourceId: string;
    similarityScore: number;
    actionTaken: "INSERTED" | "VIEWED" | "DISMISSED";
    agentId?: string;
  }): Promise<void> {
    await prisma.recommendationFeedback.create({
      data: {
        targetTicketId: data.targetTicketId,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        similarityScore: data.similarityScore,
        actionTaken: data.actionTaken,
        agentId: data.agentId || null,
      },
    });
  }
}
