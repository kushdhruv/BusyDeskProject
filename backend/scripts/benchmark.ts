import { PrismaClient } from '@prisma/client';
import { SlaController } from '../controllers/sla.controller';
import { DashboardController } from '../controllers/dashboard.controller';
import { TicketController } from '../controllers/ticket.controller';
import { Role } from '../models/types.model';

const prisma = new PrismaClient();

const supervisorUser = {
  id: 'usr_supervisor_1',
  email: 'sarah.supervisor@busydesk.com',
  name: 'Sarah Supervisor',
  role: Role.SUPERVISOR,
};

function calculateStats(latencies: number[]) {
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const avg = sum / sorted.length;
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  return { avg: avg.toFixed(2), p50: p50.toFixed(2), p95: p95.toFixed(2), p99: p99.toFixed(2), min: min.toFixed(2), max: max.toFixed(2) };
}

async function benchmarkSlaSequential(iterations = 5) {
  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await SlaController.getActiveAlerts(supervisorUser);
    const end = performance.now();
    latencies.push(end - start);
  }
  return calculateStats(latencies);
}

async function benchmarkSlaConcurrent(concurrency = 5) {
  const promises = Array.from({ length: concurrency }, async () => {
    const start = performance.now();
    await SlaController.getActiveAlerts(supervisorUser);
    const end = performance.now();
    return end - start;
  });
  const latencies = await Promise.all(promises);
  return calculateStats(latencies);
}

async function benchmarkDashboard(iterations = 10) {
  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await DashboardController.getMetrics();
    const end = performance.now();
    latencies.push(end - start);
  }
  return calculateStats(latencies);
}

async function benchmarkSearch(iterations = 10) {
  const latencies: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await TicketController.getQueue({ search: 'billing' }, supervisorUser);
    const end = performance.now();
    latencies.push(end - start);
  }
  return calculateStats(latencies);
}

async function main() {
  console.log('========================================');
  console.log('STARTING BENCHMARK SUITE');
  console.log('========================================');

  // Warmup
  await SlaController.getActiveAlerts(supervisorUser);
  await DashboardController.getMetrics();
  await TicketController.getQueue({ search: 'billing' }, supervisorUser);

  console.log('\n--- 1. SLA getActiveAlerts (Sequential: 5 runs) ---');
  const slaSeq = await benchmarkSlaSequential(5);
  console.log('SLA Sequential:', slaSeq);

  console.log('\n--- 2. SLA getActiveAlerts (Concurrent: 5 parallel) ---');
  const slaConc = await benchmarkSlaConcurrent(5);
  console.log('SLA Concurrent (5 parallel):', slaConc);

  console.log('\n--- 3. Dashboard getMetrics (Sequential: 10 runs) ---');
  const dashSeq = await benchmarkDashboard(10);
  console.log('Dashboard getMetrics:', dashSeq);

  console.log('\n--- 4. Search getQueue (?search=billing) (Sequential: 10 runs) ---');
  const searchSeq = await benchmarkSearch(10);
  console.log('Search getQueue:', searchSeq);

  console.log('\n========================================');
  console.log('BENCHMARK COMPLETE');
  console.log('========================================');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
