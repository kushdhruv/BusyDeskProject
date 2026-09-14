/**
 * Email Service
 * Production-ready transactional email service supporting Resend API with automated
 * local development console fallback.
 */

import nodemailer, { type Transporter } from "nodemailer";

function createSmtpTransporter(port: number, secure: boolean): Transporter {
  const host = process.env.SMTP_HOST?.trim() || "smtp.gmail.com";
  const user = process.env.SMTP_USER?.trim()!;
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, "").trim()!;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure,
    auth: {
      user,
      pass,
    },
    family: 4, // CRITICAL: Force IPv4 to prevent Linux containers (Render) hanging on unrouted IPv6
    connectionTimeout: 5000, // 5s connection limit
    greetingTimeout: 5000,   // 5s greeting limit
    socketTimeout: 8000,     // 8s socket limit
    dnsTimeout: 3000,        // 3s DNS limit
    tls: {
      rejectUnauthorized: false,
    },
  } as any);
}

async function sendViaSmtp(options: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ messageId: string; portUsed: number }> {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, "").trim();

  if (!user || !pass) {
    throw new Error("SMTP credentials (SMTP_USER / SMTP_PASS) not configured.");
  }

  // Priority port: if SMTP_PORT is set, use it first; otherwise 587 (universal cloud standard)
  const envPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const primaryPort = isNaN(envPort) ? 587 : envPort;
  const secondaryPort = primaryPort === 465 ? 587 : 465;

  let lastError: any = null;

  for (const port of [primaryPort, secondaryPort]) {
    try {
      const isSecure = port === 465;
      const transporter = createSmtpTransporter(port, isSecure);

      const sendPromise = transporter.sendMail({
        from: options.from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      // Strict 6.5-second timeout per attempt so HTTP never hangs
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`SMTP send timeout on port ${port} (6.5s exceeded)`)), 6500)
      );

      const info = (await Promise.race([sendPromise, timeoutPromise])) as any;
      return { messageId: info.messageId, portUsed: port };
    } catch (err: any) {
      lastError = err;
      console.warn(`[EmailService:SMTP] Port ${port} attempt failed: ${err.message}`);
    }
  }

  throw lastError || new Error("All SMTP ports failed.");
}

async function sendViaFrontendRelay(options: {
  from?: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<{ messageId: string }> {
  const frontendUrl =
    process.env.FRONTEND_URL?.trim() || "https://busydesk.vercel.app";
  const secret =
    process.env.SESSION_SECRET ||
    "support-ticketing-super-secret-key-change-in-production-minimum-32-chars-long";

  const res = await fetch(`${frontendUrl}/internal-mail`, {
    method: "POST",
    signal: AbortSignal.timeout(9000),
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": secret,
    },
    body: JSON.stringify(options),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `Frontend relay (${frontendUrl}/internal-mail) failed (${res.status}): ${errText.slice(0, 100)}`
    );
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || "Frontend relay returned success=false");
  }
  return { messageId: data.messageId };
}

export interface SendInvitationParams {
  to: string;
  name: string;
  role: string;
  rawToken: string;
  setupUrl: string;
}

export interface SendDigestEmailParams {
  to: string;
  recipientName: string;
  role: string;
  subject: string;
  htmlContent: string;
}

export interface EmailDispatchResult {
  success: boolean;
  mode: "smtp" | "resend" | "dev_console";
  id?: string;
  previewUrl?: string;
  error?: string;
}

export class EmailService {
  /**
   * Dispatches the official support agent invitation email.
   */
  static async sendAgentInvitation(params: SendInvitationParams): Promise<EmailDispatchResult> {
    const { to, name, role, setupUrl } = params;
    const subject = "You've been added as a Support Agent";
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const fromAddress = process.env.RESEND_FROM || "Busy Infotech Support <onboarding@resend.dev>";

    const plainText = `Hi ${name},

You've been added as a Support Agent on Busy Infotech Support by an administrator.

Role: ${role}
Email: ${to}

Click below to set up your account and create your password:
${setupUrl}

This invitation expires in 24 hours.

— Busy Infotech Support
`;

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #0f172a;
      margin: 0;
      padding: 32px 16px;
      -webkit-font-smoothing: antialiased;
    }
    .card {
      max-width: 540px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 36px 32px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    .header-logo {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 24px;
    }
    .badge {
      background: #0f172a;
      color: #ffffff;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 6px;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    h1 {
      font-size: 20px;
      font-weight: 600;
      color: #0f172a;
      margin: 0 0 16px 0;
      line-height: 1.4;
    }
    p {
      font-size: 14px;
      color: #334155;
      line-height: 1.6;
      margin: 0 0 16px 0;
    }
    .details-box {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px 20px;
      margin: 20px 0;
    }
    .details-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      padding: 4px 0;
    }
    .details-label {
      color: #64748b;
      font-weight: 500;
    }
    .details-val {
      color: #0f172a;
      font-weight: 600;
      font-family: monospace;
    }
    .cta-container {
      margin: 28px 0;
      text-align: left;
    }
    .cta-button {
      display: inline-block;
      background-color: #0f172a;
      color: #ffffff !important;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      padding: 12px 24px;
      border-radius: 6px;
      transition: background-color 0.15s ease;
    }
    .notice {
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
      border-top: 1px solid #e2e8f0;
      padding-top: 20px;
      margin-top: 24px;
    }
    .footer {
      font-size: 12px;
      color: #94a3b8;
      margin-top: 24px;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header-logo">
      <span class="badge">Busy Infotech Support</span>
    </div>
    <h1>You've been added as a Support Agent</h1>
    <p>Hi ${name},</p>
    <p>You've been added as a Support Agent on <strong>Busy Infotech Support</strong> by an administrator.</p>

    <div class="details-box">
      <div class="details-row">
        <span class="details-label">Role:</span>
        <span class="details-val">${role}</span>
      </div>
      <div class="details-row">
        <span class="details-label">Assigned Email:</span>
        <span class="details-val">${to}</span>
      </div>
    </div>

    <p>Click below to set up your account and create your password:</p>

    <div class="cta-container">
      <a href="${setupUrl}" class="cta-button" target="_blank" rel="noopener noreferrer">Set Up My Account</a>
    </div>

    <p style="font-size: 13px; color: #e11d48; font-weight: 500;">
      ⚠️ This invitation expires in 24 hours.
    </p>

    <div class="notice">
      If the button above does not work, copy and paste this link into your browser:<br>
      <a href="${setupUrl}" style="color: #2563eb; word-break: break-all; font-size: 12px;">${setupUrl}</a>
    </div>
  </div>

  <div class="footer">
    © ${new Date().getFullYear()} Busy Infotech Support • Automated Account Security System
  </div>
</body>
</html>
`;

    // 1. Primary Mode: SMTP (Gmail SMTP for sending to ANY email address worldwide)
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.replace(/\s+/g, "").trim();
    if (user && pass) {
      try {
        const smtpFrom =
          process.env.SMTP_FROM || `Busy Infotech Support <${user}>`;

        const result = await sendViaSmtp({
          from: smtpFrom,
          to,
          subject,
          text: plainText,
          html: htmlContent,
        });

        console.log(`[EmailService] Invitation email delivered via direct SMTP (port ${result.portUsed}) to ${to} (id: ${result.messageId})`);
        return {
          success: true,
          mode: "smtp",
          id: result.messageId,
          previewUrl: setupUrl,
        };
      } catch (smtpErr: any) {
        console.warn("[EmailService:Direct SMTP failed, trying Vercel HTTPS Relay]", smtpErr?.message || smtpErr);
      }
    }

    // 2. Secondary Mode: Vercel HTTPS Relay (bypasses cloud host SMTP egress firewalls via port 443)
    try {
      const relayResult = await sendViaFrontendRelay({
        from: process.env.SMTP_FROM || (user ? `Busy Infotech Support <${user}>` : undefined),
        to,
        subject,
        text: plainText,
        html: htmlContent,
      });

      console.log(`[EmailService] Invitation email delivered via Vercel HTTPS Relay to ${to} (id: ${relayResult.messageId})`);
      return {
        success: true,
        mode: "smtp",
        id: relayResult.messageId,
        previewUrl: setupUrl,
      };
    } catch (relayErr: any) {
      console.warn("[EmailService:Vercel HTTPS Relay failed or not reachable]", relayErr?.message || relayErr);
    }

    // 2. Secondary Mode: Resend API is configured
    if (apiKey) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [to],
            subject,
            html: htmlContent,
            text: plainText,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          console.warn("[EmailService:Resend Error]", data);
          // Fall back to console log so development/testing is not blocked
          this.logDevConsoleEmail({ to, subject, name, role, setupUrl });
          return {
            success: false,
            mode: "dev_console",
            error: data?.message || "Resend API returned non-200",
            previewUrl: setupUrl,
          };
        }

        console.log(`[EmailService] Invitation email delivered via Resend to ${to} (id: ${data.id})`);
        return {
          success: true,
          mode: "resend",
          id: data.id,
          previewUrl: setupUrl,
        };
      } catch (err: any) {
        console.error("[EmailService:Resend Exception]", err);
        this.logDevConsoleEmail({ to, subject, name, role, setupUrl });
        return {
          success: false,
          mode: "dev_console",
          error: err.message,
          previewUrl: setupUrl,
        };
      }
    }

    // 3. Development Mode: Console Logger Fallback
    this.logDevConsoleEmail({ to, subject, name, role, setupUrl });
    return {
      success: true,
      mode: "dev_console",
      previewUrl: setupUrl,
    };
  }

  /**
   * Dispatches periodic queue digests to staff (agent or supervisor).
   */
  static async sendDigestEmail(params: SendDigestEmailParams): Promise<EmailDispatchResult> {
    const { to, recipientName, subject, htmlContent } = params;
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const fromAddress = process.env.RESEND_FROM || "Busy Infotech Support <onboarding@resend.dev>";
    const plainText = `Hi ${recipientName},\n\nHere is your SupportDesk ticket queue digest.\n\nPlease open this email in an HTML-compatible client or web browser to view your complete interactive metrics.`;

    // 1. Primary Mode: SMTP (Gmail SMTP for sending to ANY email address worldwide)
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.replace(/\s+/g, "").trim();
    if (user && pass) {
      try {
        const smtpFrom =
          process.env.SMTP_FROM || `Busy Infotech Support <${user}>`;

        const result = await sendViaSmtp({
          from: smtpFrom,
          to,
          subject,
          text: plainText,
          html: htmlContent,
        });

        console.log(`[EmailService] Digest email delivered via direct SMTP (port ${result.portUsed}) to ${to} (id: ${result.messageId})`);
        return {
          success: true,
          mode: "smtp",
          id: result.messageId,
        };
      } catch (smtpErr: any) {
        console.warn("[EmailService:Direct SMTP failed for digest, trying Vercel HTTPS Relay]", smtpErr?.message || smtpErr);
      }
    }

    // 2. Secondary Mode: Vercel HTTPS Relay (bypasses cloud host SMTP egress firewalls via port 443)
    try {
      const relayResult = await sendViaFrontendRelay({
        from: process.env.SMTP_FROM || (user ? `Busy Infotech Support <${user}>` : undefined),
        to,
        subject,
        text: plainText,
        html: htmlContent,
      });

      console.log(`[EmailService] Digest email delivered via Vercel HTTPS Relay to ${to} (id: ${relayResult.messageId})`);
      return {
        success: true,
        mode: "smtp",
        id: relayResult.messageId,
      };
    } catch (relayErr: any) {
      console.warn("[EmailService:Vercel HTTPS Relay digest failed or not reachable]", relayErr?.message || relayErr);
    }

    // 2. Secondary Mode: Resend API
    if (apiKey) {
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [to],
            subject,
            html: htmlContent,
            text: plainText,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          console.warn("[EmailService:Resend Digest Error]", data);
          this.logDevConsoleDigest({ to, subject, recipientName });
          return {
            success: false,
            mode: "dev_console",
            error: data?.message || "Resend API returned non-200",
          };
        }

        console.log(`[EmailService] Digest email delivered via Resend to ${to} (id: ${data.id})`);
        return {
          success: true,
          mode: "resend",
          id: data.id,
        };
      } catch (err: any) {
        console.error("[EmailService:Resend Digest Exception]", err);
        this.logDevConsoleDigest({ to, subject, recipientName });
        return {
          success: false,
          mode: "dev_console",
          error: err.message,
        };
      }
    }

    // 3. Fallback Mode: Dev Console
    this.logDevConsoleDigest({ to, subject, recipientName });
    return {
      success: true,
      mode: "dev_console",
    };
  }

  private static logDevConsoleEmail(params: {
    to: string;
    subject: string;
    name: string;
    role: string;
    setupUrl: string;
  }) {
    const separator = "═".repeat(78);
    console.log(`\n╔${separator}╗`);
    console.log(`║ 📧 [DEV EMAIL SERVICE - AGENT INVITATION DISPATCH]`);
    console.log(`╟${separator}╢`);
    console.log(`║ To:         ${params.to}`);
    console.log(`║ Subject:    ${params.subject}`);
    console.log(`║ Name:       ${params.name}`);
    console.log(`║ Role:       ${params.role}`);
    console.log(`║ Expiration: 24 Hours`);
    console.log(`╟${separator}╢`);
    console.log(`║ Setup URL:`);
    console.log(`║ ${params.setupUrl}`);
    console.log(`╚${separator}╝\n`);
  }

  private static logDevConsoleDigest(params: {
    to: string;
    subject: string;
    recipientName: string;
  }) {
    const separator = "═".repeat(78);
    console.log(`\n╔${separator}╗`);
    console.log(`║ 📬 [DEV EMAIL SERVICE - QUEUE DIGEST DISPATCH]`);
    console.log(`╟${separator}╢`);
    console.log(`║ To:         ${params.to}`);
    console.log(`║ Recipient:  ${params.recipientName}`);
    console.log(`║ Subject:    ${params.subject}`);
    console.log(`╟${separator}╢`);
    console.log(`║ Note: Set RESEND_API_KEY in backend/.env for live inbox delivery.`);
    console.log(`╚${separator}╝\n`);
  }
}
