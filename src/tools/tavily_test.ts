import { describe, it, expect, vi } from "vitest";
import { searchTavily } from "./tavily.js";

describe("searchTavily", () => {
  it("rejects immediately if API key is missing", async () => {
    await expect(searchTavily("test query", "")).rejects.toThrow("Tavily API key is missing");
  });

  it("parses valid Tavily JSON response", async () => {
    const mockResponse = {
      results: [
        {
          title: "HubSpot Pricing 2026",
          url: "https://hubspot.com/pricing",
          content: "HubSpot launched new seat-based pricing model in 2024.",
          published_date: "2026-03-01",
        },
      ],
    };

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    try {
      const results = await searchTavily("HubSpot pricing", "test-key");
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("HubSpot Pricing 2026");
      expect(results[0].url).toBe("https://hubspot.com/pricing");
      expect(results[0].content).toContain("seat-based pricing");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("handles HTTP 429 rate limit error gracefully", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => "Rate limit exceeded",
    } as Response);

    try {
      await expect(searchTavily("test query", "test-key")).rejects.toThrow("Tavily error HTTP 429");
    } finally {
      global.fetch = originalFetch;
    }
  });
});
