import { NextResponse } from "next/server";
import { getSessionUser } from "@/middlewares/auth.middleware";
import { ReplyController } from "@/controllers/reply.controller";

export async function addAgentReplyRoute(
  req: Request,
  params: { id: string }
): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      body: replyBody,
      isInternal,
      attachmentUrl,
      attachmentName,
      attachmentSize,
      attachmentType,
    } = body;

    const trimmedBody = (replyBody || "").trim();
    if (!trimmedBody && !attachmentUrl) {
      return NextResponse.json(
        { error: "Reply body or attachment cannot be empty." },
        { status: 400 }
      );
    }

    const reply = await ReplyController.addAgentReply(
      params.id,
      {
        body: trimmedBody || (attachmentName ? `Attached file: ${attachmentName}` : "Attachment"),
        isInternal: Boolean(isInternal),
        attachmentUrl,
        attachmentName,
        attachmentSize,
        attachmentType,
      },
      user
    );

    return NextResponse.json({ reply }, { status: 201 });
  } catch (error: any) {
    const status = error.message.includes("permission") ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function addCustomerReplyRoute(
  req: Request,
  params: { id: string }
): Promise<NextResponse> {
  try {
    const body = await req.json();
    const {
      body: replyBody,
      customerName,
      customerEmail,
      attachmentUrl,
      attachmentName,
      attachmentSize,
      attachmentType,
    } = body;

    const trimmedBody = (replyBody || "").trim();
    if (!trimmedBody && !attachmentUrl) {
      return NextResponse.json(
        { error: "Reply body or attachment cannot be empty." },
        { status: 400 }
      );
    }

    const reply = await ReplyController.addCustomerReply(params.id, {
      body: trimmedBody || (attachmentName ? `Attached file: ${attachmentName}` : "Attachment"),
      customerName,
      customerEmail,
      attachmentUrl,
      attachmentName,
      attachmentSize,
      attachmentType,
    });

    return NextResponse.json({ reply }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
