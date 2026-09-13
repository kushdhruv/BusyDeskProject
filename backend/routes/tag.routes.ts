/**
 * Tag & Tag Group API Routes
 * HTTP route handlers for tags, tag groups, search, merge, and ticket tag associations.
 */

import { NextResponse } from "next/server";
import { getSessionUser } from "@/middlewares/auth.middleware";
import { TagController } from "@/controllers/tag.controller";

// ==========================================
// TAG GROUPS ROUTES
// ==========================================

export async function listTagGroupsRoute(req: Request): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const groups = await TagController.listTagGroups(user);
    return NextResponse.json({ groups });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to list tag groups." },
      { status: 400 }
    );
  }
}

export async function createTagGroupRoute(req: Request): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const group = await TagController.createTagGroup(body, user);
    return NextResponse.json({ group }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create tag group." },
      { status: 400 }
    );
  }
}

export async function getTagGroupByIdRoute(
  req: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const group = await TagController.getTagGroupById(params.id, user);
    return NextResponse.json({ group });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to retrieve tag group." },
      { status: 404 }
    );
  }
}

export async function updateTagGroupRoute(
  req: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const group = await TagController.updateTagGroup(params.id, body, user);
    return NextResponse.json({ group });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update tag group." },
      { status: 400 }
    );
  }
}

export async function deleteTagGroupRoute(
  req: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await TagController.deleteTagGroup(params.id, user);
    return NextResponse.json({ success: true, message: "Tag group deleted successfully." });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete tag group." },
      { status: 400 }
    );
  }
}

// ==========================================
// TAGS ROUTES
// ==========================================

export async function listTagsRoute(req: Request): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId") || undefined;
    const ungroupedOnly = searchParams.get("ungrouped") === "true";
    const search = searchParams.get("search") || undefined;

    const tags = await TagController.listTags({ groupId, ungroupedOnly, search }, user);
    return NextResponse.json({ tags });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to list tags." },
      { status: 400 }
    );
  }
}

export async function searchTagsRoute(req: Request): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") || "";
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 10;

    const tags = await TagController.searchTags(q, user, limit);
    return NextResponse.json({ tags });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to search tags." },
      { status: 400 }
    );
  }
}

export async function createTagRoute(req: Request): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const tag = await TagController.createTag(body, user);
    return NextResponse.json({ tag }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to create tag." },
      { status: 400 }
    );
  }
}

export async function getTagByIdRoute(
  req: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tag = await TagController.getTagById(params.id, user);
    return NextResponse.json({ tag });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to retrieve tag." },
      { status: 404 }
    );
  }
}

export async function updateTagRoute(
  req: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const tag = await TagController.updateTag(params.id, body, user);
    return NextResponse.json({ tag });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update tag." },
      { status: 400 }
    );
  }
}

export async function deleteTagRoute(
  req: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await TagController.deleteTag(params.id, user);
    return NextResponse.json({ success: true, message: "Tag deleted successfully." });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete tag." },
      { status: 400 }
    );
  }
}

export async function mergeTagsRoute(
  req: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    if (!body.targetTagId) {
      return NextResponse.json({ error: "targetTagId is required for tag merge." }, { status: 400 });
    }

    const result = await TagController.mergeTags(params.id, body.targetTagId, user);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to merge tags." },
      { status: 400 }
    );
  }
}

// ==========================================
// TICKET TAGS ROUTES
// ==========================================

export async function getTicketTagsRoute(
  req: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tags = await TagController.getTicketTags(params.id, user);
    return NextResponse.json({ tags });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch ticket tags." },
      { status: 400 }
    );
  }
}

export async function addTicketTagsRoute(
  req: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    if (!body.tagIds || !Array.isArray(body.tagIds)) {
      return NextResponse.json({ error: "tagIds must be an array of tag IDs." }, { status: 400 });
    }

    const tags = await TagController.addTagsToTicket(params.id, body.tagIds, user);
    return NextResponse.json({ tags }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to add tags to ticket." },
      { status: 400 }
    );
  }
}

export async function removeTicketTagRoute(
  req: Request,
  { params }: { params: { id: string; tagId: string } }
): Promise<NextResponse> {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await TagController.removeTagFromTicket(params.id, params.tagId, user);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to remove tag from ticket." },
      { status: 400 }
    );
  }
}
