/**
 * Email Service
 * Production-ready transactional email service supporting Resend API with automated
 * local development console fallback.
 */

import nodemailer from "nodemailer";

let cachedTransporter: nodemailer.Transporter | null = null;

function getSmtpTransporter(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, "").trim();

  if (!host || !user || !pass) {
    return null;
  }

  if (!cachedTransporter) {
    const port = Number(process.env.SMTP_PORT) || 465;
    const secure = process.env.SMTP_SECURE === "true" || port === 465;

    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
  }

  return cachedTransporter;
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
    const smtpTransporter = getSmtpTransporter();
    if (smtpTransporter) {
      try {
        const smtpFrom =
          process.env.SMTP_FROM || `Busy Infotech Support <${process.env.SMTP_USER}>`;

        const info = await smtpTransporter.sendMail({
          from: smtpFrom,
          to,
          subject,
          text: plainText,
          html: htmlContent,
        });

        console.log(`[EmailService] Invitation email delivered via SMTP to ${to} (id: ${info.messageId})`);
        return {
          success: true,
          mode: "smtp",
          id: info.messageId,
          previewUrl: setupUrl,
        };
      } catch (smtpErr: any) {
        console.error("[EmailService:SMTP Exception]", smtpErr);
        // Fall through to Resend or Dev Console if SMTP fails
      }
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
    const smtpTransporter = getSmtpTransporter();
    if (smtpTransporter) {
      try {
        const smtpFrom =
          process.env.SMTP_FROM || `Busy Infotech Support <${process.env.SMTP_USER}>`;

        const info = await smtpTransporter.sendMail({
          from: smtpFrom,
          to,
          subject,
          text: plainText,
          html: htmlContent,
        });

        console.log(`[EmailService] Digest email delivered via SMTP to ${to} (id: ${info.messageId})`);
        return {
          success: true,
          mode: "smtp",
          id: info.messageId,
        };
      } catch (smtpErr: any) {
        console.error("[EmailService:SMTP Digest Exception]", smtpErr);
        // Fall through to Resend or Dev Console if SMTP fails
      }
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
