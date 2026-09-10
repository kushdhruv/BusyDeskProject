import { NextResponse } from "next/server";
import { getSessionUser } from "@/middlewares/auth.middleware";
import { CsatController } from "@/controllers/csat.controller";

export async function submitCsatRoute(
  req: Request,
  params: { id: string }
): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { rating, comment } = body;

    if (
      typeof rating !== "number" ||
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      return NextResponse.json(
        { error: "Rating must be an integer between 1 and 5." },
        { status: 400 }
      );
    }

    const csat = await CsatController.submitCsat(
      params.id,
      { rating, comment },
      user
    );

    return NextResponse.json({ satisfaction: csat }, { status: 201 });
  } catch (error: any) {
    const status =
      error.message.includes("permission") ||
      error.message.includes("not permitted")
        ? 403
        : error.message.includes("not found")
        ? 404
        : 400;
    return NextResponse.json({ error: error.message }, { status });
  }
}
