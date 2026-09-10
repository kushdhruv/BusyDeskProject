import { addCollaboratorRoute, removeCollaboratorRoute } from "@/routes/collaboration.routes";

interface RouteParams {
  params: { id: string };
}

export async function POST(req: Request, { params }: RouteParams) {
  return addCollaboratorRoute(req, params);
}

export async function DELETE(req: Request, { params }: RouteParams) {
  return removeCollaboratorRoute(req, params);
}
