import { NextResponse } from "next/server";
import { prisma } from "@/db/prisma.db";
import { EmailService } from "@/services/email.service";
import net from "net";

function checkTcpPort(
  host: string,
  port: number,
  timeoutMs = 2500
): Promise<{ port: number; open: boolean; error?: string }> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => {
      socket.destroy();
      resolve({ port, open: true });
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve({
        port,
        open: false,
        error: "TIMEOUT (Port likely blocked by host egress firewall)",
      });
    });
    socket.on("error", (err) => {
      socket.destroy();
      resolve({ port, open: false, error: err.message });
    });
    socket.connect(port, host);
  });
}

export async function getHealthRoute(req: Request): Promise<NextResponse> {
  const startTime = Date.now();
  try {
    // Ping PostgreSQL to confirm active connection
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - startTime;

    let testSendResult: any = null;
    if (req) {
      const url = new URL(req.url);
      const sendTo = url.searchParams.get("sendTo")?.trim();
      if (sendTo) {
        testSendResult = await EmailService.sendAgentInvitation({
          to: sendTo,
          name: "Diagnostic Test User",
          role: "Support Agent",
          rawToken: "diagnostic-test-token",
          setupUrl: `${process.env.FRONTEND_URL || "https://busydesk.vercel.app"}/setup-account?token=diagnostic-test-token`,
        });
      }
    }

    const [port587, port465] = await Promise.all([
      checkTcpPort("smtp.gmail.com", 587, 2500),
      checkTcpPort("smtp.gmail.com", 465, 2500),
    ]);

    const smtpUser = process.env.SMTP_USER?.trim();
    const maskedUser = smtpUser
      ? `${smtpUser.slice(0, 3)}***@${smtpUser.split("@")[1] || ""}`
      : "NOT_CONFIGURED";

    return NextResponse.json(
      {
        status: "ok",
        database: "connected",
        latencyMs,
        environment: process.env.NODE_ENV || "development",
        emailDiagnostics: {
          hasSmtpUser: !!smtpUser,
          smtpUser: maskedUser,
          hasSmtpPass: !!process.env.SMTP_PASS,
          smtpPassLength: process.env.SMTP_PASS?.replace(/\s+/g, "").length || 0,
          smtpHost: process.env.SMTP_HOST || "smtp.gmail.com (default)",
          smtpPortConfigured: process.env.SMTP_PORT || "auto (587 -> 465)",
          hasResendKey: !!process.env.RESEND_API_KEY,
          frontendUrl: process.env.FRONTEND_URL || "https://busydesk.vercel.app (default)",
          tcpPort587: port587,
          tcpPort465: port465,
          testSendResult,
        },
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
