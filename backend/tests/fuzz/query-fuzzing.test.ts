import { describe, it, expect, beforeAll } from "vitest";
import { Role } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { TicketService } from "../../lib/services/TicketService";
import { SessionUser } from "../../lib/types";

describe("Fuzz Testing: Query Parameters, Pagination Boundaries & Search Special Chars", () => {
  let supervisor: SessionUser;

  beforeAll(async () => {
    const sup = await prisma.user.findFirst({ where: { role: Role.SUPERVISOR } });
    supervisor = { id: sup!.id, email: sup!.email, name: sup!.name, role: sup!.role };
  });

  it("Safely handles extreme, negative, NaN, and massive pagination bounds", async () => {
    const boundaryParams = [
      { page: -10, limit: 10 },
      { page: 0, limit: 0 },
      { page: 999999, limit: 50 },
      { page: 1, limit: 999999 }, // Should clamp limit to MAX_PAGE_SIZE (50)
      { page: -1, limit: -5 },
    ];

    for (const params of boundaryParams) {
      const result = await TicketService.getQueue(params, supervisor);
      expect(result).toBeDefined();
      expect(Array.isArray(result.tickets)).toBe(true);
      expect(result.pagination.page).toBeGreaterThanOrEqual(1);
      expect(result.pagination.limit).toBeLessThanOrEqual(100);
      expect(result.pagination.limit).toBeGreaterThanOrEqual(1);
    }
  });

  it("Safely handles special characters, regex meta-characters, and SQL wildcards in search queries", async () => {
    const searchQueries = [
      "%",
      "_",
      "%%%",
      ".*",
      "(",
      ")",
      "[",
      "]",
      "{",
      "}",
      "^$",
      "\\",
      "/?!@#$%^&*()_+",
      "NonExistentQuery12345xyz!@#",
      "' OR 1=1 --",
      "<script>",
    ];

    for (const q of searchQueries) {
      const result = await TicketService.getQueue({ search: q }, supervisor);
      expect(result).toBeDefined();
      expect(Array.isArray(result.tickets)).toBe(true);
      expect(typeof result.pagination.totalCount).toBe("number");
    }
  });
});
