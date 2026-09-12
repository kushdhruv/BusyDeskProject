/**
 * Recommendation Controller
 * Handles HTTP requests and security authorization for semantic recommendations and feedback.
 */

import { Role } from "@prisma/client";
import { SessionUser } from "../models/types.model";
import { RecommendationService } from "../services/recommendation.service";

export class RecommendationController {
  /**
   * Retrieves semantic solution recommendations for an active ticket.
   * Restricts cross-ticket intelligence to AGENT and SUPERVISOR roles.
   */
  static async getTicketRecommendations(ticketId: string, actor: SessionUser) {
    if (!actor) {
      throw new Error("Authentication required.");
    }

    if (actor.role === Role.CUSTOMER) {
      throw new Error("Forbidden: Only Support Staff can access cross-ticket solution recommendations.");
    }

    if (!ticketId) {
      throw new Error("Ticket ID is required.");
    }

    return RecommendationService.getRecommendationsForTicket(ticketId);
  }

  /**
   * Semantic search across public Knowledge Base articles.
   * Accessible to all authenticated roles (Staff + Customers).
   */
  static async searchKnowledgeBase(query: string, actor: SessionUser) {
    if (!actor) {
      throw new Error("Authentication required.");
    }

    return RecommendationService.searchKnowledgeBase(query);
  }

  /**
   * Logs agent telemetry feedback.
   */
  static async logFeedback(
    data: {
      targetTicketId: string;
      sourceType: "TICKET" | "KB";
      sourceId: string;
      similarityScore: number;
      actionTaken: "INSERTED" | "VIEWED" | "DISMISSED";
    },
    actor: SessionUser
  ) {
    if (!actor || actor.role === Role.CUSTOMER) {
      throw new Error("Forbidden: Only Support Staff can submit recommendation feedback.");
    }

    return RecommendationService.logFeedback({
      ...data,
      agentId: actor.id,
    });
  }
}
