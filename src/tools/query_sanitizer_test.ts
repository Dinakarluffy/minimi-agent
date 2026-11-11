import { describe, it, expect } from "vitest";
import { sanitizeSearchQuery } from "./query_sanitizer.js";

describe("sanitizeSearchQuery", () => {
  it("trims whitespace and collapses multiple spaces/newlines", () => {
    const res = sanitizeSearchQuery("   Postgres    pricing\n\nchanges   ");
    expect(res.isValid).toBe(true);
    expect(res.sanitized).toBe("Postgres pricing changes");
  });

  it("strips outer quotes cleanly", () => {
    const res = sanitizeSearchQuery('"HubSpot CRM pricing changes 2024"');
    expect(res.isValid).toBe(true);
    expect(res.sanitized).toBe("HubSpot CRM pricing changes 2024");
  });

  it("rejects empty or whitespace-only queries", () => {
    expect(sanitizeSearchQuery("").isValid).toBe(false);
    expect(sanitizeSearchQuery("   \t\n  ").isValid).toBe(false);
    // @ts-expect-error testing invalid input types
    expect(sanitizeSearchQuery(null).isValid).toBe(false);
  });

  it("enforces maximum length budget safely", () => {
    const longQuery = "a ".repeat(200);
    const res = sanitizeSearchQuery(longQuery, 100);
    expect(res.isValid).toBe(true);
    expect(res.sanitized.length).toBeLessThanOrEqual(100);
  });

  it("strips unprintable control characters", () => {
    const dirty = "hello\x00world\x1Ftest";
    const res = sanitizeSearchQuery(dirty);
    expect(res.sanitized).toBe("helloworldtest");
  });
});
