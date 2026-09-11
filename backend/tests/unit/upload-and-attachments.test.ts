import { describe, it, expect } from "vitest";
import { POST as uploadHandler } from "@/app/api/upload/route";
import { GET as fileServeHandler } from "@/app/api/files/[filename]/route";

describe("Unit Tests: File Upload & Attachment Security", () => {
  it("Upload route rejects requests when no file is attached", async () => {
    const formData = new FormData();
    const req = new Request("http://localhost:3001/api/upload", {
      method: "POST",
      body: formData,
    });

    const res = await uploadHandler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("No file provided");
  });

  it("File serve route blocks directory traversal attempts", async () => {
    const req = new Request("http://localhost:3001/api/files/../../etc/passwd");
    const res = await fileServeHandler(req, {
      params: { filename: "../../etc/passwd" },
    });

    expect(res.status).toBe(403);
  });

  it("File serve route returns 404 for non-existent files", async () => {
    const req = new Request("http://localhost:3001/api/files/non_existent_file.pdf");
    const res = await fileServeHandler(req, {
      params: { filename: "non_existent_file.pdf" },
    });

    expect(res.status).toBe(404);
  });
});
