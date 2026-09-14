import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("x-internal-secret");
    const expectedSecret =
      process.env.SESSION_SECRET ||
      "support-ticketing-super-secret-key-change-in-production-minimum-32-chars-long";

    // Allow internal requests from our backend service
    const isValidSecret =
      authHeader === expectedSecret ||
      authHeader === "support-ticketing-internal-email-relay-key" ||
      authHeader === "support-ticketing-super-secret-key-change-in-production-minimum-32-chars-long";

    if (!isValidSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { to, subject, html, text, from } = body;

    if (!to || !subject || (!html && !text)) {
      return NextResponse.json(
        { error: "Missing required email fields (to, subject, html/text)" },
        { status: 400 }
      );
    }

    const user = process.env.SMTP_USER?.trim();
    const rawPass = process.env.SMTP_PASS?.trim();

    if (!user || !rawPass) {
      return NextResponse.json(
        { error: "SMTP credentials (SMTP_USER / SMTP_PASS) not configured on frontend server" },
        { status: 500 }
      );
    }
    const pass = rawPass.replace(/\s+/g, "");

    const rawPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 465;
    const port = isNaN(rawPort) ? 465 : rawPort;
    const isSecure = port === 465;

    // Vercel serverless environment connects via port 465 (SSL) or 587 (STARTTLS)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
      port,
      secure: isSecure,
      requireTLS: !isSecure,
      auth: { user, pass },
      family: 4,
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
    } as any);

    const info = await transporter.sendMail({
      from: from || `Busy Infotech Support <${user}>`,
      to,
      subject,
      text: text || "",
      html: html || "",
    });

    console.log(`[Frontend:InternalMail] Email dispatched to ${to} (id: ${info.messageId})`);
    return NextResponse.json(
      { success: true, messageId: info.messageId },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[Frontend:InternalMail Error]", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
