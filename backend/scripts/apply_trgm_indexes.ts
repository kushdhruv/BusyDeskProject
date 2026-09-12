import { prisma } from "../db/prisma.db";

async function applyTrgmIndexes() {
  console.log("Creating GIN trigram indexes on tickets...");

  await prisma.$executeRawUnsafe(`
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_tickets_subject_trgm 
    ON tickets USING gin (subject gin_trgm_ops);
  `);
  console.log("Created idx_tickets_subject_trgm");

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_tickets_description_trgm 
    ON tickets USING gin (description gin_trgm_ops);
  `);
  console.log("Created idx_tickets_description_trgm");

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_tickets_requester_name_trgm 
    ON tickets USING gin ("requesterName" gin_trgm_ops);
  `);
  console.log("Created idx_tickets_requester_name_trgm");

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_tickets_requester_email_trgm 
    ON tickets USING gin ("requesterEmail" gin_trgm_ops);
  `);
  console.log("Created idx_tickets_requester_email_trgm");

  const indexes: any[] = await prisma.$queryRaw`
    SELECT indexname, pg_size_pretty(pg_relation_size(quote_ident(indexname)::regclass)) AS index_size
    FROM pg_indexes
    WHERE tablename = 'tickets' AND indexname LIKE '%trgm%'
    ORDER BY indexname;
  `;
  console.log("\nCreated Trigram Indexes in PostgreSQL:");
  console.table(indexes);

  await prisma.$disconnect();
}

applyTrgmIndexes().catch(console.error);
