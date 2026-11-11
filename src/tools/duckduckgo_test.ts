import { describe, it, expect, vi } from "vitest";
import { searchDuckDuckGo } from "./duckduckgo.js";

describe("searchDuckDuckGo", () => {
  it("parses mock DuckDuckGo HTML correctly", async () => {
    const mockHtml = `
      <div class="result results_links results_links_deep web-result">
        <h2 class="result__title">
          <a class="result__url" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fsupabase.com%2Fpricing">Supabase Pricing</a>
        </h2>
        <a class="result__snippet" href="#">Supabase offers managed Postgres with free tier and pro tier starting at $25/month.</a>
      </div>
      <div class="result results_links results_links_deep web-result">
        <h2 class="result__title">
          <a class="result__url" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fneon.tech%2Fpricing">Neon Serverless Postgres Pricing</a>
        </h2>
        <a class="result__snippet" href="#">Neon serverless Postgres has usage-based pricing with generous free tier.</a>
      </div>
    `;

    // Mock global fetch
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockHtml,
    } as Response);

    try {
      const results = await searchDuckDuckGo("Postgres hosting pricing", { maxResults: 5 });
      expect(results).toHaveLength(2);
      expect(results[0].title).toBe("Supabase Pricing");
      expect(results[0].url).toBe("https://supabase.com/pricing");
      expect(results[0].content).toContain("Supabase offers managed Postgres");
      expect(results[1].url).toBe("https://neon.tech/pricing");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("handles network failure gracefully by throwing descriptive error", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error("Network timeout"));

    try {
      await expect(searchDuckDuckGo("test query")).rejects.toThrow("Network timeout");
    } finally {
      global.fetch = originalFetch;
    }
  });
});
