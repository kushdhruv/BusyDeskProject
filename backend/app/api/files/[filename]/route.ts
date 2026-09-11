import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".json": "application/json",
  ".zip": "application/zip",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

interface RouteParams {
  params: { filename: string };
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const filename = params.filename;
    const filePath = path.resolve(UPLOADS_DIR, filename);

    // Prevent path traversal attacks
    if (!filePath.startsWith(UPLOADS_DIR)) {
      return new Response("Forbidden", { status: 403 });
    }

    try {
      await fs.access(filePath);
    } catch {
      return new Response("File not found", { status: 404 });
    }

    const buffer = await fs.readFile(filePath);
    const ext = path.extname(filename).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    const isDownload = new URL(req.url).searchParams.has("download");
    const disposition = isDownload ? `attachment; filename="${filename}"` : "inline";

    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": disposition,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error: any) {
    console.error("File serve error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
