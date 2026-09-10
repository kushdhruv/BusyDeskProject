import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { ExportService } from "@/lib/services/ExportService";
import { GetQueueParams } from "@/lib/services/TicketService";
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
    };

    const csvData = await ExportService.exportToCsv(params, user);

    const filename = `tickets-export-${new Date().toISOString().split("T")[0]}.csv`;

    return new NextResponse(csvData, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to generate CSV export." },
      { status: 500 }
    );
  }
}
