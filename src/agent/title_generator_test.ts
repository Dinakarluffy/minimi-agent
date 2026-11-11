import { describe, it, expect } from "vitest";
import { createFallbackTitle } from "./title_generator.js";

describe("createFallbackTitle", () => {
  it("creates a safe fallback title from long text", () => {
    const text = "What is the current stable release of Next.js and Node.js today?";
    const title = createFallbackTitle(text);
    expect(title).toBe("What is the current stable");
    expect(title.length).toBeLessThanOrEqual(35);
  });

  it("handles short text nicely", () => {
    const text = "Postgres pricing";
    const title = createFallbackTitle(text);
    expect(title).toBe("Postgres pricing");
  });

  it("handles empty text safely", () => {
    expect(createFallbackTitle("")).toBe("New Conversation");
  });
});
