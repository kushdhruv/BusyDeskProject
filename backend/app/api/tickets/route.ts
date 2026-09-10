import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { TicketService, GetQueueParams } from "@/lib/services/TicketService";
import { Priority, Category, Status } from "@prisma/client";

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const params: GetQueueParams = {
      search: searchParams.get("search") || undefined,
      status: (searchParams.get("status") as Status) || undefined,
      priority: (searchParams.get("priority") as Priority) || undefined,
      category: (searchParams.get("category") as Category) || undefined,
      assigneeId: searchParams.get("assigneeId") || undefined,
      scope: (searchParams.get("scope") as GetQueueParams["scope"]) || "all",
      sort: (searchParams.get("sort") as GetQueueParams["sort"]) || "createdAt",
      order: (searchParams.get("order") as GetQueueParams["order"]) || "desc",
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 15,
    };

    const queueData = await TicketService.getQueue(params, user);
    return NextResponse.json(queueData);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch ticket queue." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const ticket = await TicketService.createTicket(body, user);
    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create ticket." },
      { status: 400 }
    );
  }
}
