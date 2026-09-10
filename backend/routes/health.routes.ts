import { NextResponse } from "next/server";
import { prisma } from "@/db/prisma.db";

export async function getHealthRoute(): Promise<NextResponse> {
  const startTime = Date.now();
  try {
    // Ping PostgreSQL to confirm active connection
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startTime;

    return NextResponse.json(
      {
        status: "ok",
        database: "connected",
        latencyMs,
        environment: process.env.NODE_ENV || "development",
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    return NextResponse.json(
      {
        status: "degraded",
        database: "disconnected",
        error: error.message || "Database connection error",
        latencyMs,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
