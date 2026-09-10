import { describe, it, expect, vi } from "vitest";
import { getHealthRoute } from "@/routes/health.routes";
import { prisma } from "@/db/prisma.db";

describe("Health Check Route", () => {
  it("should return status ok when database ping succeeds", async () => {
    const res = await getHealthRoute();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe("ok");
    expect(data.database).toBe("connected");
    expect(data).toHaveProperty("latencyMs");
    expect(data).toHaveProperty("timestamp");
  });

  it("should return degraded status if database connection fails", async () => {
    const spy = vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(new Error("Connection refused"));

    const res = await getHealthRoute();
    expect(res.status).toBe(503);

    const data = await res.json();
    expect(data.status).toBe("degraded");
    expect(data.database).toBe("disconnected");
    expect(data.error).toBe("Connection refused");

    spy.mockRestore();
  });
});
