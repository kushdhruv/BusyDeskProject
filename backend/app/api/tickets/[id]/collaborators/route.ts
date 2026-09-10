import { NextResponse } from "next/server";
import { getSessionUser } from "@/middlewares/auth.middleware";
import { CollaborationController } from "@/controllers/collaboration.controller";

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
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "Target userId is required." }, { status: 400 });
    }

    const collab = await CollaborationController.addCollaborator(params.id, userId, user);
    return NextResponse.json({ collaborator: collab }, { status: 201 });
  } catch (error: any) {
    const status = error.message.includes("permission") || error.message.includes("Only") ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Target userId is required." }, { status: 400 });
    }

    await CollaborationController.removeCollaborator(params.id, userId, user);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    const status = error.message.includes("permission") || error.message.includes("Only") ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
