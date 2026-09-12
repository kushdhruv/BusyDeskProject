-- Enable the pgvector extension in Supabase PostgreSQL
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge Base Articles Table
CREATE TABLE IF NOT EXISTS kb_articles (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'QUESTION',
    "isPublished" BOOLEAN DEFAULT true,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ticket Embeddings Table with vector(1536)
CREATE TABLE IF NOT EXISTS ticket_embeddings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    ticket_id TEXT UNIQUE REFERENCES tickets(id) ON DELETE CASCADE,
    embedding vector(1536) NOT NULL,
    resolution_summary TEXT NOT NULL,
    csat_score INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- KB Embeddings Table with vector(1536)
CREATE TABLE IF NOT EXISTS kb_embeddings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    article_id TEXT UNIQUE REFERENCES kb_articles(id) ON DELETE CASCADE,
    embedding vector(1536) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Recommendation Feedback Audit Table
CREATE TABLE IF NOT EXISTS recommendation_feedback (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "targetTicketId" TEXT REFERENCES tickets(id) ON DELETE CASCADE,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "similarityScore" DOUBLE PRECISION NOT NULL,
    "actionTaken" TEXT NOT NULL,
    "agentId" TEXT REFERENCES users(id) ON DELETE SET NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- High-Performance HNSW Index for Sub-Millisecond Cosine Similarity
CREATE INDEX IF NOT EXISTS idx_ticket_embeddings_hnsw 
ON ticket_embeddings USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_kb_embeddings_hnsw 
ON kb_embeddings USING hnsw (embedding vector_cosine_ops) 
WITH (m = 16, ef_construction = 64);
