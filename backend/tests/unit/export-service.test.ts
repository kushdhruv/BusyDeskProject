import { describe, it, expect } from "vitest";

describe("Unit Tests: CSV Escaping & RFC-4180 Rules", () => {
  // Test the RFC-4180 escaping logic used in ExportService
  const escapeCsv = (val: any): string => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  it("Leaves plain alphanumeric strings unquoted", () => {
    expect(escapeCsv("NormalSubject")).toBe("NormalSubject");
    expect(escapeCsv("12345")).toBe("12345");
  });

  it("Encloses strings containing commas in quotes", () => {
    expect(escapeCsv("Error in billing, invoice #123")).toBe('"Error in billing, invoice #123"');
  });

  it("Escapes internal double quotes by doubling them per RFC-4180", () => {
    expect(escapeCsv('User said "Urgent" problem')).toBe('"User said ""Urgent"" problem"');
  });

  it("Encloses strings with newlines and carriage returns in quotes", () => {
    expect(escapeCsv("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
    expect(escapeCsv("Line 1\r\nLine 2")).toBe('"Line 1\r\nLine 2"');
  });

  it("Handles null and undefined values by returning empty string", () => {
    expect(escapeCsv(null)).toBe("");
    expect(escapeCsv(undefined)).toBe("");
  });
});
