import { prisma } from "../db/prisma.db";

async function inspectDb() {
  console.log("==================================================");
  console.log("DEEP DBMS INSPECTION & QUERY ANALYSIS");
  console.log("==================================================");

  // 1. Table Counts & Sizes
  const tableStats: any[] = await prisma.$queryRaw`
    SELECT 
      relname AS table_name,
      n_live_tup AS row_estimate,
      pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
      pg_size_pretty(pg_relation_size(relid)) AS data_size,
      pg_size_pretty(pg_indexes_size(relid)) AS index_size
    FROM pg_stat_user_tables
    ORDER BY pg_total_relation_size(relid) DESC;
  `;
  console.log("\n--- 1. Table Row Counts & Storage Footprint ---");
  console.table(tableStats);

  // 2. All Indexes in Database
  const indexStats: any[] = await prisma.$queryRaw`
    SELECT 
      schemaname,
      tablename,
      indexname,
      pg_size_pretty(pg_relation_size(quote_ident(indexname)::regclass)) AS index_size,
      indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname;
  `;
  console.log("\n--- 2. All Defined Indexes ---");
  for (const idx of indexStats) {
    console.log(`[${idx.tablename}] ${idx.indexname} (${idx.index_size}): ${idx.indexdef}`);
  }

  // 3. PostgreSQL Server & Connection Pool Settings
  const settings: any[] = await prisma.$queryRaw`
    SELECT name, setting, unit, short_desc
    FROM pg_settings
    WHERE name IN (
      'max_connections',
      'shared_buffers',
      'work_mem',
      'maintenance_work_mem',
      'effective_cache_size',
      'random_page_cost',
      'seq_page_cost'
    );
  `;
  console.log("\n--- 3. Key PostgreSQL Configuration Settings ---");
  console.table(settings);

  // 4. Active Connections
  const connections: any[] = await prisma.$queryRaw`
    SELECT count(*) as total_connections, state
    FROM pg_stat_activity
    GROUP BY state;
  `;
  console.log("\n--- 4. Current DB Connection State ---");
  console.table(connections);

  // 5. EXPLAIN ANALYZE on Core Queries
  console.log("\n--- 5. EXPLAIN ANALYZE ON CORE QUERIES ---");

  // Query A: Queue retrieval (Agent view: open/new, unarchived, order by createdAt desc limit 15)
  console.log("\n[Query A: Agent Queue - Default Filter & Sort]");
  const planQueue: any[] = await prisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS, COSTS)
    SELECT id, "ticketNumber", subject, priority, category, status, "primaryAssigneeId", "slaDueAt", "createdAt"
    FROM tickets
    WHERE "archivedAt" IS NULL
      AND status IN ('NEW', 'OPEN')
    ORDER BY "createdAt" DESC
    LIMIT 15;
  `);
  console.log(planQueue.map(r => r["QUERY PLAN"]).join("\n"));

  // Query B: Queue search (ILIKE on 4 columns with limit 15)
  console.log("\n[Query B: Queue Search ILIKE 'issue']");
  const planSearch: any[] = await prisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS, COSTS)
    SELECT id, "ticketNumber", subject, "requesterName", "requesterEmail"
    FROM tickets
    WHERE "archivedAt" IS NULL
      AND (
        subject ILIKE '%issue%'
        OR description ILIKE '%issue%'
        OR "requesterName" ILIKE '%issue%'
        OR "requesterEmail" ILIKE '%issue%'
      )
    ORDER BY "createdAt" DESC
    LIMIT 15;
  `);
  console.log(planSearch.map(r => r["QUERY PLAN"]).join("\n"));

  // Query C: Ticket Details with Timeline (Replies + Audit Logs)
  const sampleTicket: any[] = await prisma.$queryRaw`
    SELECT id FROM tickets WHERE "archivedAt" IS NULL LIMIT 1;
  `;
  if (sampleTicket.length > 0) {
    const tid = sampleTicket[0].id;
    console.log(`\n[Query C: Ticket Detail by ID (${tid})]`);
    const planDetail: any[] = await prisma.$queryRawUnsafe(`
      EXPLAIN (ANALYZE, BUFFERS, COSTS)
      SELECT * FROM tickets WHERE id = '${tid}';
    `);
    console.log(planDetail.map(r => r["QUERY PLAN"]).join("\n"));

    console.log(`\n[Query C2: Ticket Timeline Replies (${tid})]`);
    const planReplies: any[] = await prisma.$queryRawUnsafe(`
      EXPLAIN (ANALYZE, BUFFERS, COSTS)
      SELECT * FROM replies WHERE "ticketId" = '${tid}' ORDER BY "createdAt" ASC;
    `);
    console.log(planReplies.map(r => r["QUERY PLAN"]).join("\n"));

    console.log(`\n[Query C3: Ticket Timeline Audit Logs (${tid})]`);
    const planAudit: any[] = await prisma.$queryRawUnsafe(`
      EXPLAIN (ANALYZE, BUFFERS, COSTS)
      SELECT * FROM audit_logs WHERE "ticketId" = '${tid}' ORDER BY "createdAt" ASC;
    `);
    console.log(planAudit.map(r => r["QUERY PLAN"]).join("\n"));
  }

  // Query D: Dashboard Headline Metrics Queries
  console.log("\n[Query D: Dashboard Open Tickets Count]");
  const planDash: any[] = await prisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS, COSTS)
    SELECT count(*) FROM tickets
    WHERE "archivedAt" IS NULL AND status IN ('NEW', 'OPEN');
  `);
  console.log(planDash.map(r => r["QUERY PLAN"]).join("\n"));

  // Query E: SLA Active Alerts Query
  console.log("\n[Query E: SLA Active Alerts Fetch]");
  const planSla: any[] = await prisma.$queryRawUnsafe(`
    EXPLAIN (ANALYZE, BUFFERS, COSTS)
    SELECT a.id, a.type, a.status, a."ticketId", t.subject, t.priority, t."slaDueAt"
    FROM sla_alerts a
    JOIN tickets t ON t.id = a."ticketId"
    WHERE a.status = 'ACTIVE'
      AND t."archivedAt" IS NULL
      AND t.status IN ('NEW', 'OPEN')
      AND t."slaDueAt" IS NOT NULL
    ORDER BY a.type ASC, a."createdAt" ASC;
  `);
  console.log(planSla.map(r => r["QUERY PLAN"]).join("\n"));

  // 6. Network Latency Ping: Direct measurement of RTT vs Query Time
  console.log("\n--- 6. Network Round-Trip vs Engine Execution Time ---");
  const pingTimes: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    const r: any[] = await prisma.$queryRaw`SELECT 1 as ping, extract(epoch from clock_timestamp()) as ts;`;
    const t1 = performance.now();
    pingTimes.push(t1 - t0);
  }
  console.log("Ping RTT times (ms):", pingTimes.map(t => t.toFixed(2)));
  console.log("Avg RTT (ms):", (pingTimes.reduce((a, b) => a + b, 0) / pingTimes.length).toFixed(2));

  await prisma.$disconnect();
}

inspectDb().catch(console.error);
