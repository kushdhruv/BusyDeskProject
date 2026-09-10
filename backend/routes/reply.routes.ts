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
    const { body: replyBody, isInternal } = body;

    if (!replyBody || !replyBody.trim()) {
      return NextResponse.json(
        { error: "Reply body cannot be empty." },
        { status: 400 }
      );
    }

    const reply = await ReplyController.addAgentReply(
      params.id,
      { body: replyBody, isInternal: Boolean(isInternal) },
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
    const { body: replyBody, customerName, customerEmail } = body;

    if (!replyBody || !replyBody.trim()) {
      return NextResponse.json(
        { error: "Reply body cannot be empty." },
        { status: 400 }
      );
    }

    const reply = await ReplyController.addCustomerReply(params.id, {
      body: replyBody,
      customerName,
      customerEmail,
    });

    return NextResponse.json({ reply }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
