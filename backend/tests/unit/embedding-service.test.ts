import { describe, it, expect } from "vitest";
import { EmbeddingService } from "@/services/embedding.service";

describe("Unit Tests: EmbeddingService & Vector Operations", () => {
  it("should generate a 1536-dimensional normalized vector for given text", async () => {
    const text = "How to configure OAuth 2.0 redirect URI for single sign on";
    const vector = await EmbeddingService.generateEmbedding(text);

    expect(vector).toBeDefined();
    expect(vector.length).toBe(1536);

    // Assert vector is L2 normalized (magnitude ~ 1.0)
    let magnitudeSq = 0;
    for (const val of vector) {
      magnitudeSq += val * val;
    }
    expect(Math.sqrt(magnitudeSq)).toBeCloseTo(1.0, 4);
  });

  it("should return zero vector for empty text input", async () => {
    const vector = await EmbeddingService.generateEmbedding("");
    expect(vector.length).toBe(1536);
    expect(vector.every((v) => v === 0)).toBe(true);
  });

  it("should compute high cosine similarity between semantically similar sentences", async () => {
    const vecA = await EmbeddingService.generateEmbedding("OAuth 2.0 token refresh invalid_grant error");
    const vecB = await EmbeddingService.generateEmbedding("Resolving OAuth invalid_grant token refresh issues");
    const vecC = await EmbeddingService.generateEmbedding("Prorated billing invoice credit note adjustment");

    const similaritySimilar = EmbeddingService.cosineSimilarity(vecA, vecB);
    const similarityDifferent = EmbeddingService.cosineSimilarity(vecA, vecC);

    expect(similaritySimilar).toBeGreaterThan(0.60);
    expect(similarityDifferent).toBeLessThan(0.40);
    expect(similaritySimilar).toBeGreaterThan(similarityDifferent);
  });

  it("should produce identical vectors deterministically for identical inputs", async () => {
    const text = "System SLA breach warning calculation for urgent priority tickets";
    const vec1 = await EmbeddingService.generateEmbedding(text);
    const vec2 = await EmbeddingService.generateEmbedding(text);

    expect(vec1).toEqual(vec2);
    expect(EmbeddingService.cosineSimilarity(vec1, vec2)).toBeCloseTo(1.0, 5);
  });
});
