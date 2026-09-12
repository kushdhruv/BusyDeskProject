import { prisma } from "../db/prisma.db";

async function listIndexes() {
  const indexes: any[] = await prisma.$queryRaw`
    SELECT tablename, indexname, indexdef 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename IN ('tickets', 'replies', 'audit_logs', 'sla_alerts', 'customer_satisfactions', 'ticket_collaborators', 'users')
    ORDER BY tablename, indexname;
  `;
  for (const i of indexes) {
    console.log(`[${i.tablename}] ${i.indexname}\n  -> ${i.indexdef}\n`);
  }
  await prisma.$disconnect();
}

listIndexes().catch(console.error);
