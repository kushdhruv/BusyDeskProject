import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("x-internal-secret");
    const expectedSecret =
      process.env.SESSION_SECRET ||
      "support-ticketing-super-secret-key-change-in-production-minimum-32-chars-long";

    // Allow internal requests from our backend service
    if (authHeader !== expectedSecret) {
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

    const user = process.env.SMTP_USER?.trim() || "dhruvstudy77@gmail.com";
    const rawPass = process.env.SMTP_PASS?.trim() || "jtep gxlm ecwr bxno";
    const pass = rawPass.replace(/\s+/g, "");

    // Vercel serverless environment connects directly via port 465 (SSL)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
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
