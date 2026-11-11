import { describe, it, expect } from "vitest";
import { parseTemporalExpression } from "./temporal_parser.js";

describe("parseTemporalExpression", () => {
  // Reference date: Wednesday, Nov 11, 2026
  const refDate = new Date("2026-11-11T12:00:00Z");

  it("parses exact month and day: 'What did I ask you on 3 November?'", () => {
    const res = parseTemporalExpression("What did I ask you on 3 November?", refDate);
    expect(res).not.toBeNull();
    expect(res?.label).toContain("3 november 2026");
    expect(new Date(res!.startDate).getMonth()).toBe(10); // November is 10 (0-indexed)
    expect(new Date(res!.startDate).getDate()).toBe(3);
  });

  it("parses 'Nov 3rd' variant", () => {
    const res = parseTemporalExpression("Check logs for Nov 3rd", refDate);
    expect(res).not.toBeNull();
    expect(new Date(res!.startDate).getDate()).toBe(3);
  });

  it("parses 'last Tuesday' relative to Wednesday Nov 11", () => {
    // Nov 11 is Wednesday. The immediate previous Tuesday is Nov 10.
    const res = parseTemporalExpression("Last Tuesday I asked you about Postgres hosting", refDate);
    expect(res).not.toBeNull();
    const parsedStart = new Date(res!.startDate);
    expect(parsedStart.getDay()).toBe(2); // Tuesday
  });

  it("parses 'since Monday' relative to Wednesday Nov 11", () => {
    const res = parseTemporalExpression("Has anything changed since Monday?", refDate);
    expect(res).not.toBeNull();
    expect(res?.label).toBe("since monday");
    const parsedStart = new Date(res!.startDate);
    expect(parsedStart.getDay()).toBe(1); // Monday
    // endDate should be current day end
    expect(new Date(res!.endDate).getDate()).toBe(11);
  });

  it("parses 'yesterday'", () => {
    const res = parseTemporalExpression("what did we do yesterday?", refDate);
    expect(res).not.toBeNull();
    expect(new Date(res!.startDate).getDate()).toBe(10);
  });

  it("returns null for non-temporal expressions", () => {
    expect(parseTemporalExpression("What is the capital of France?")).toBeNull();
    expect(parseTemporalExpression("Calculate 25 * 40")).toBeNull();
    expect(parseTemporalExpression("")).toBeNull();
  });
});
