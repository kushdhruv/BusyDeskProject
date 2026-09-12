import { prisma } from "../db/prisma.db";
import { TicketController } from "../controllers/ticket.controller";
import { Role } from "../models/types.model";

const supervisorUser = {
  id: "usr_supervisor_1",
  email: "sarah.supervisor@busydesk.com",
  name: "Sarah Supervisor",
  role: Role.SUPERVISOR,
};

async function benchmark() {
  const ticket = await prisma.ticket.findFirst({
    where: { archivedAt: null },
    select: { id: true },
  });
  if (!ticket) return;

  console.log("Testing ticket ID:", ticket.id);

  // 1. Current implementation (2 sequential round-trips)
  const currentTimes: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    await TicketController.getTicketDetails(ticket.id, supervisorUser);
    currentTimes.push(performance.now() - t0);
  }
  const avgCurrent = currentTimes.reduce((a, b) => a + b, 0) / currentTimes.length;
  console.log("Current getTicketDetails (ms):", currentTimes.map(t => t.toFixed(2)), "Avg:", avgCurrent.toFixed(2));

  // 2. Single-roundtrip combined query test
  const singleQueryTimes: number[] = [];
  for (let i = 0; i < 5; i++) {
    const t0 = performance.now();
    const data = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      include: {
        createdBy: { select: { id: true, name: true, email: true, role: true } },
        primaryAssignee: { select: { id: true, name: true, email: true, role: true } },
        collaborators: {
          include: {
            user: { select: { id: true, name: true, email: true, role: true } },
            addedBy: { select: { id: true, name: true } },
          },
        },
        slaAlerts: {
          where: { status: { in: ["ACTIVE", "ACKNOWLEDGED"] } },
          orderBy: { createdAt: "desc" },
        },
        satisfaction: {
          select: { id: true, rating: true, comment: true, createdAt: true },
        },
        replies: {
          orderBy: { createdAt: "asc" },
        },
        auditLogs: {
          where: { eventType: { not: "REPLY_ADDED" } },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    // Merge timeline in memory
    const items: any[] = [];
    if (data) {
      for (const r of data.replies) {
        items.push({
          id: `reply-${r.id}`,
          type: "REPLY",
          createdAt: r.createdAt.toISOString(),
          reply: r,
        });
      }
      for (const a of data.auditLogs) {
        items.push({
          id: `audit-${a.id}`,
          type: "AUDIT",
          createdAt: a.createdAt.toISOString(),
          audit: a,
        });
      }
      items.sort((x, y) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime());
    }
    singleQueryTimes.push(performance.now() - t0);
  }
  const avgSingle = singleQueryTimes.reduce((a, b) => a + b, 0) / singleQueryTimes.length;
  console.log("Single-Query getTicketDetails (ms):", singleQueryTimes.map(t => t.toFixed(2)), "Avg:", avgSingle.toFixed(2));
  console.log(`Speedup: ${(avgCurrent / avgSingle).toFixed(2)}x faster! Latency reduced by ${(((avgCurrent - avgSingle) / avgCurrent) * 100).toFixed(1)}%`);

  await prisma.$disconnect();
}

benchmark().catch(console.error);
