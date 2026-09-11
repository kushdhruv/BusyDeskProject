import { prisma } from '../db/prisma.db';

async function verifySearchPlanner() {
  console.log('=====================================================');
  console.log('PG_TRGM GIN SEARCH INDEX VERIFICATION & COST ANALYSIS');
  console.log('=====================================================');

  // 1. Check GIN index storage sizes
  const indexSizes: any[] = await prisma.$queryRaw`
    SELECT 
      indexname,
      pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size,
      pg_relation_size(indexname::regclass) AS raw_bytes
    FROM pg_indexes
    WHERE tablename = 'tickets' AND indexname LIKE '%trgm%'
    ORDER BY raw_bytes DESC;
  `;
  console.log('\n--- 1. GIN Index Storage Footprints ---');
  console.table(indexSizes);

  // 2. EXPLAIN (ANALYZE, BUFFERS) with default planner on current dataset (104 rows)
  console.log('\n--- 2. Query Plan with Default Planner Settings (104 rows) ---');
  const defaultPlan: any[] = await prisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT id, "ticketNumber", "subject", "requesterName"
    FROM tickets
    WHERE "archivedAt" IS NULL
      AND (
        "subject" ILIKE '%billing%'
        OR "description" ILIKE '%billing%'
        OR "requesterName" ILIKE '%billing%'
        OR "requesterEmail" ILIKE '%billing%'
      )
    ORDER BY "createdAt" DESC
    LIMIT 20;
  `);
  console.log(defaultPlan.map((r) => r['QUERY PLAN']).join('\n'));

  // 3. EXPLAIN (ANALYZE, BUFFERS) with enable_seqscan = off to verify GIN index path
  console.log('\n--- 3. Query Plan with enable_seqscan = off (Forcing Index Path) ---');
  await prisma.$executeRawUnsafe(`SET enable_seqscan = off;`);
  const indexPlan: any[] = await prisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT id, "ticketNumber", "subject", "requesterName"
    FROM tickets
    WHERE "archivedAt" IS NULL
      AND (
        "subject" ILIKE '%billing%'
        OR "description" ILIKE '%billing%'
        OR "requesterName" ILIKE '%billing%'
        OR "requesterEmail" ILIKE '%billing%'
      )
    ORDER BY "createdAt" DESC
    LIMIT 20;
  `);
  console.log(indexPlan.map((r) => r['QUERY PLAN']).join('\n'));
  await prisma.$executeRawUnsafe(`SET enable_seqscan = on;`);

  // 4. Single-column search (subject) index test
  console.log('\n--- 4. Subject-Only Search Plan with enable_seqscan = off ---');
  await prisma.$executeRawUnsafe(`SET enable_seqscan = off;`);
  const subjectPlan: any[] = await prisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS)
    SELECT id, "subject"
    FROM tickets
    WHERE "subject" ILIKE '%billing%';
  `);
  console.log(subjectPlan.map((r) => r['QUERY PLAN']).join('\n'));
  await prisma.$executeRawUnsafe(`SET enable_seqscan = on;`);

  await prisma.$disconnect();
}

verifySearchPlanner().catch(console.error);
