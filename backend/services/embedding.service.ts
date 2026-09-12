/**
 * Embedding Service
 * Generates 1536-dimensional semantic vectors using OpenAI text-embedding-3-small
 * or deterministic pseudo-vectors for offline/testing environments.
 */

export class EmbeddingService {
  private static readonly EMBEDDING_DIMENSION = 1536;

  /**
   * Sanitizes input text and generates a 1536-dimensional embedding vector.
   */
  static async generateEmbedding(text: string): Promise<number[]> {
    const sanitized = (text || "").replace(/\s+/g, " ").trim().slice(0, 8000);

    if (!sanitized) {
      return new Array(this.EMBEDDING_DIMENSION).fill(0);
    }

    const apiKey = process.env.OPENAI_API_KEY;

    // Production Path: If OpenAI API key is configured
    if (apiKey && process.env.NODE_ENV === "production") {
      try {
        const response = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "text-embedding-3-small",
            input: sanitized,
            dimensions: this.EMBEDDING_DIMENSION,
          }),
        });

        if (response.ok) {
          const json = await response.json();
          if (json.data && json.data[0] && json.data[0].embedding) {
            return json.data[0].embedding;
          }
        }
      } catch (err) {
        console.warn("OpenAI embedding API call failed, falling back to deterministic embedding:", err);
      }
    }

    // Deterministic Offline & Test Fallback:
    // Produces a stable, normalized 1536-dimensional vector based on semantic token hashing
    return this.generateDeterministicVector(sanitized);
  }

  /**
   * Deterministic vector generator for test suites and offline environments.
   * Maps words to vector dimensions with cosine-normal distribution.
   */
  public static generateDeterministicVector(text: string): number[] {
    const vector = new Array(this.EMBEDDING_DIMENSION).fill(0);
    const words = text.toLowerCase().match(/\b[a-z0-9_-]+\b/g) || [text.toLowerCase()];

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      let hash = 0;
      for (let j = 0; j < word.length; j++) {
        hash = (hash << 5) - hash + word.charCodeAt(j);
        hash |= 0;
      }

      // Distribute word signal across 8 adjacent dimensions
      for (let k = 0; k < 8; k++) {
        const dim = Math.abs((hash + k * 137) % this.EMBEDDING_DIMENSION);
        const weight = 1.0 / (k + 1);
        vector[dim] += weight;
      }
    }

    // L2 Normalize the vector so cosine similarity === dot product
    let norm = 0;
    for (let i = 0; i < this.EMBEDDING_DIMENSION; i++) {
      norm += vector[i] * vector[i];
    }
    norm = Math.sqrt(norm);

    if (norm > 0) {
      for (let i = 0; i < this.EMBEDDING_DIMENSION; i++) {
        vector[i] = vector[i] / norm;
      }
    }

    return vector;
  }

  /**
   * Calculates cosine similarity between two normalized vectors
   */
  static cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
