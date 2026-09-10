import { NextResponse } from "next/server";
import { getSessionUser } from "@/middlewares/auth.middleware";
import { TicketController, GetQueueParams } from "@/controllers/ticket.controller";
import { Priority, Category, Status } from "@prisma/client";

export async function getTicketsRoute(req: Request): Promise<NextResponse> {
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

    const queueData = await TicketController.getQueue(params, user);
    return NextResponse.json(queueData);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch ticket queue." },
      { status: 500 }
    );
  }
}

export async function createTicketRoute(req: Request): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const ticket = await TicketController.createTicket(body, user);
    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create ticket." },
      { status: 400 }
    );
  }
}

export async function getTicketByIdRoute(
  req: Request,
  params: { id: string }
): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await TicketController.getTicketDetails(params.id, user);
    return NextResponse.json(data);
  } catch (error: any) {
    const status = error.message.includes("permission")
      ? 403
      : error.message.includes("not found")
      ? 404
      : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function updateTicketRoute(
  req: Request,
  params: { id: string }
): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const ticket = await TicketController.updateTicketDetails(params.id, body, user);
    return NextResponse.json({ ticket });
  } catch (error: any) {
    const status = error.message.includes("permission") ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function changeTicketStatusRoute(
  req: Request,
  params: { id: string }
): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { status } = body;

    if (!status || !Object.values(Status).includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${Object.values(Status).join(", ")}` },
        { status: 400 }
      );
    }

    const ticket = await TicketController.changeStatus(params.id, status as Status, user);
    return NextResponse.json({ ticket });
  } catch (error: any) {
    const isPermission =
      error.message.includes("permission") ||
      error.message.includes("Supervisors are authorized");
    const status = isPermission ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function reassignTicketRoute(
  req: Request,
  params: { id: string }
): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { primaryAssigneeId } = body;

    const ticket = await TicketController.reassign(
      params.id,
      primaryAssigneeId || null,
      user
    );
    return NextResponse.json({ ticket });
  } catch (error: any) {
    const status = error.message.includes("Supervisors") ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function archiveTicketRoute(
  req: Request,
  params: { id: string }
): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ticket = await TicketController.archive(params.id, user);
    return NextResponse.json({ ticket });
  } catch (error: any) {
    const status = error.message.includes("permission") ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}

export async function restoreTicketRoute(
  req: Request,
  params: { id: string }
): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ticket = await TicketController.restore(params.id, user);
    return NextResponse.json({ ticket });
  } catch (error: any) {
    const status = error.message.includes("permission") ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
