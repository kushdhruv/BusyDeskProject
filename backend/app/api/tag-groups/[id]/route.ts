import {
  getTagGroupByIdRoute,
  updateTagGroupRoute,
  deleteTagGroupRoute,
} from "@/routes/tag.routes";

export const GET = getTagGroupByIdRoute;
export const PATCH = updateTagGroupRoute;
export const DELETE = deleteTagGroupRoute;
