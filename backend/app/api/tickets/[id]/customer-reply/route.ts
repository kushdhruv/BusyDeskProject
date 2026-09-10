import { NextResponse } from "next/server";
import { ReplyService } from "@/lib/services/ReplyService";

interface RouteParams {
  params: { id: string };
}

export async function POST(req: Request, { params }: RouteParams) {
  try {
    const body = await req.json();
    const { body: replyBody, customerName, customerEmail } = body;

    if (!replyBody || !replyBody.trim()) {
      return NextResponse.json({ error: "Reply body cannot be empty." }, { status: 400 });
    }

    const reply = await ReplyService.addCustomerReply(params.id, {
      body: replyBody,
      customerName,
      customerEmail,
    });

    return NextResponse.json({ reply }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
