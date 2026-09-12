import { prisma } from "../db/prisma.db";
import { TicketController } from "../controllers/ticket.controller";
import { SlaController } from "../controllers/sla.controller";
import { DashboardController } from "../controllers/dashboard.controller";
import { TimelineController } from "../controllers/timeline.controller";
import { ReplyController } from "../controllers/reply.controller";
import { Role, Status, Priority, Category } from "../models/types.model";

const supervisorUser = {
  id: "usr_supervisor_1",
  email: "sarah.supervisor@busydesk.com",
  name: "Sarah Supervisor",
  role: Role.SUPERVISOR,
};

const agentUser = {
  id: "usr_agent_alex",
  email: "alex.chen@busydesk.com",
  name: "Alex Chen",
  role: Role.AGENT,
};

interface LatencyStats {
  count: number;
  errors: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  rps: number;
  durationMs: number;
}

function calculateStats(latencies: number[], errors: number, totalDurationMs: number): LatencyStats {
  if (latencies.length === 0) {
    return { count: 0, errors, avg: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0, rps: 0, durationMs: totalDurationMs };
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const avg = sum / sorted.length;
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const rps = (sorted.length / (totalDurationMs / 1000));

  return {
    count: sorted.length,
    errors,
    avg: Number(avg.toFixed(2)),
    p50: Number(p50.toFixed(2)),
    p95: Number(p95.toFixed(2)),
    p99: Number(p99.toFixed(2)),
    min: Number(min.toFixed(2)),
    max: Number(max.toFixed(2)),
    rps: Number(rps.toFixed(2)),
    durationMs: Number(totalDurationMs.toFixed(2)),
  };
}

// Fetch a valid ticket ID for detail/timeline benchmarking
let testTicketId = "";

async function setupTestData() {
  const ticket = await prisma.ticket.findFirst({
    where: { archivedAt: null },
    select: { id: true },
  });
  if (ticket) {
    testTicketId = ticket.id;
  }
}

// 1. Queue Read Operation (Filtering & Pagination)
async function opGetQueue() {
  return TicketController.getQueue(
    { status: Status.OPEN, limit: 15, page: 1 },
    supervisorUser
  );
}

// 2. Ticket Detail + Timeline Read Operation
async function opGetTicketDetail() {
  if (!testTicketId) return;
  return TicketController.getTicketDetails(testTicketId, supervisorUser);
}

// 3. SLA Active Alerts Read Operation (Polled every 15s by frontend)
async function opGetSlaAlerts() {
  return SlaController.getActiveAlerts(supervisorUser);
}

// 4. Dashboard Analytics Metrics Read Operation
async function opGetDashboardMetrics() {
  return DashboardController.getMetrics(supervisorUser);
}

// 5. Search Queue Read Operation
async function opSearchQueue() {
  return TicketController.getQueue(
    { search: "issue", limit: 15, page: 1 },
    supervisorUser
  );
}

// 6. Write Operation: Customer Reply
async function opAddCustomerReply() {
  if (!testTicketId) return;
  return ReplyController.addCustomerReply(testTicketId, {
    body: `Automated benchmark reply at ${new Date().toISOString()}`,
    customerName: "Benchmark Tester",
    customerEmail: "benchmark@example.com",
  });
}

/**
 * Realistic Read-Heavy Workload Simulator
 * Simulates a 90% Read / 10% Write distribution:
 * - 30% SLA Alert Polling (due to dual component polling in TopBar & Sidebar)
 * - 25% Queue Listings (filtering, pagination)
 * - 20% Ticket Detail & Unified Timeline Views
 * - 10% Dashboard Metrics Views
 * - 5%  Full-text / ILIKE Searches
 * - 10% Customer & Agent Replies (Writes)
 */
async function executeWeightedOperation(): Promise<void> {
  const rand = Math.random() * 100;
  if (rand < 30) {
    await opGetSlaAlerts();
  } else if (rand < 55) {
    await opGetQueue();
  } else if (rand < 75) {
    await opGetTicketDetail();
  } else if (rand < 85) {
    await opGetDashboardMetrics();
  } else if (rand < 90) {
    await opSearchQueue();
  } else {
    await opAddCustomerReply();
  }
}

/**
 * Runs a load test with N concurrent workers executing M total operations.
 */
async function runLoadTest(concurrency: number, totalOps: number): Promise<LatencyStats> {
  const opsPerWorker = Math.ceil(totalOps / concurrency);
  const latencies: number[] = [];
  let errors = 0;

  const wallStart = performance.now();

  const workerPromises = Array.from({ length: concurrency }, async (_, workerIdx) => {
    for (let i = 0; i < opsPerWorker; i++) {
      const opStart = performance.now();
      try {
        await executeWeightedOperation();
        const opEnd = performance.now();
        latencies.push(opEnd - opStart);
      } catch (err: any) {
        errors++;
        // console.error(`Worker ${workerIdx} error:`, err.message);
      }
    }
  });

  await Promise.all(workerPromises);
  const wallEnd = performance.now();

  return calculateStats(latencies, errors, wallEnd - wallStart);
}

/**
 * Benchmark single endpoints sequentially to get clean latency profiles.
 */
async function benchmarkIndividualEndpoints(iterations = 10) {
  console.log(`\n======================================================`);
  console.log(`ISOLATED ENDPOINT LATENCY PROFILES (${iterations} sequential runs)`);
  console.log(`======================================================`);

  const endpoints = [
    { name: "SLA Alerts (getActiveAlerts)", fn: opGetSlaAlerts },
    { name: "Ticket Queue (getQueue)", fn: opGetQueue },
    { name: "Queue Search (search=issue)", fn: opSearchQueue },
    { name: "Ticket Details (getTicketDetails)", fn: opGetTicketDetail },
    { name: "Dashboard Metrics (getMetrics)", fn: opGetDashboardMetrics },
  ];

  for (const ep of endpoints) {
    const lats: number[] = [];
    let errs = 0;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      try {
        await ep.fn();
        lats.push(performance.now() - t0);
      } catch (e: any) {
        errs++;
      }
    }
    const end = performance.now();
    const stats = calculateStats(lats, errs, end - start);
    console.log(`\n[${ep.name}]`);
    console.log(`  Count: ${stats.count} | Errors: ${stats.errors}`);
    console.log(`  p50: ${stats.p50} ms | p95: ${stats.p95} ms | p99: ${stats.p99} ms | Avg: ${stats.avg} ms`);
    console.log(`  Min: ${stats.min} ms | Max: ${stats.max} ms | RPS: ${stats.rps}`);
  }
}

async function main() {
  await setupTestData();
  console.log(`Using sample ticket ID: ${testTicketId}`);

  // 1. Warmup
  console.log("Warming up connections...");
  try {
    await opGetQueue();
    await opGetSlaAlerts();
    await opGetDashboardMetrics();
  } catch (e) {}

  // 2. Individual endpoint profiles
  await benchmarkIndividualEndpoints(8);

  // 3. Multi-Concurrency Realistic Load Tests (90% Read / 10% Write)
  console.log(`\n======================================================`);
  console.log(`REALISTIC LOAD & STRESS TESTS (90% Read / 10% Write)`);
  console.log(`======================================================`);

  const scenarios = [
    { concurrency: 1, totalOps: 10, label: "Level 1: Sequential (c=1)" },
    { concurrency: 5, totalOps: 20, label: "Level 2: Light Traffic (c=5)" },
    { concurrency: 10, totalOps: 30, label: "Level 3: Moderate Traffic (c=10)" },
    { concurrency: 20, totalOps: 40, label: "Level 4: Saturation Test (c=20 > pool_limit 15)" },
    { concurrency: 35, totalOps: 70, label: "Level 5: Stress Test (c=35 >> pool_limit 15)" },
  ];

  const resultsTable: any[] = [];

  for (const s of scenarios) {
    console.log(`\nRunning ${s.label}...`);
    // Check connection stats before run
    const preConns: any[] = await prisma.$queryRaw`
      SELECT count(*) as count, state FROM pg_stat_activity GROUP BY state;
    `;
    const stats = await runLoadTest(s.concurrency, s.totalOps);
    
    // Check connection stats after run
    const postConns: any[] = await prisma.$queryRaw`
      SELECT count(*) as count, state FROM pg_stat_activity GROUP BY state;
    `;

    resultsTable.push({
      Scenario: s.label,
      Concurrency: s.concurrency,
      Ops: stats.count,
      Errors: stats.errors,
      "p50 (ms)": stats.p50,
      "p95 (ms)": stats.p95,
      "p99 (ms)": stats.p99,
      "Avg (ms)": stats.avg,
      RPS: stats.rps,
      "Duration (s)": (stats.durationMs / 1000).toFixed(2),
    });
  }

  console.log(`\n======================================================`);
  console.log(`LOAD TEST RESULTS SUMMARY`);
  console.log(`======================================================`);
  console.table(resultsTable);

  await prisma.$disconnect();
}

main().catch(console.error);
