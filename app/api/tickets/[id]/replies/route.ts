import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ReplyService } from "@/lib/services/ReplyService";

interface RouteParams {
  params: { id: string };
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { body: replyBody, isInternal } = body;

    if (!replyBody || !replyBody.trim()) {
      return NextResponse.json({ error: "Reply body cannot be empty." }, { status: 400 });
    }

    const reply = await ReplyService.addAgentReply(
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
