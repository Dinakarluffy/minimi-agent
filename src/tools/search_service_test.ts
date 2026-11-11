import { describe, it, expect, vi, beforeEach } from "vitest";
import { SearchService } from "./search_service.js";
import * as tavilyModule from "./tavily.js";
import * as ddgModule from "./duckduckgo.js";

describe("SearchService", () => {
  let service: SearchService;

  beforeEach(() => {
    vi.restoreAllMocks();
    service = new SearchService(undefined, 1000);
  });

  it("returns fallback error when given an invalid query", async () => {
    const res = await service.search("   ");
    expect(res.provider).toBe("fallback");
    expect(res.results).toHaveLength(0);
    expect(res.error).toBeDefined();
  });

  it("uses DuckDuckGo when no Tavily API key is set", async () => {
    vi.spyOn(ddgModule, "searchDuckDuckGo").mockResolvedValue([
      { title: "Neon DB", url: "https://neon.tech", content: "Serverless Postgres" },
    ]);

    const res = await service.search("Neon Postgres");
    expect(res.provider).toBe("duckduckgo");
    expect(res.results).toHaveLength(1);
    expect(res.results[0].title).toBe("Neon DB");
  });

  it("attempts Tavily first and falls back to DuckDuckGo on Tavily failure", async () => {
    service.setTavilyApiKey("invalid-or-failing-key");

    vi.spyOn(tavilyModule, "searchTavily").mockRejectedValue(new Error("Rate limit 429"));
    vi.spyOn(ddgModule, "searchDuckDuckGo").mockResolvedValue([
      { title: "Supabase Pricing", url: "https://supabase.com", content: "Pro tier $25" },
    ]);

    const res = await service.search("Supabase pricing");
    expect(res.provider).toBe("duckduckgo");
    expect(res.results).toHaveLength(1);
    expect(res.results[0].title).toBe("Supabase Pricing");
  });

  it("serves repeated queries from cache", async () => {
    const ddgSpy = vi.spyOn(ddgModule, "searchDuckDuckGo").mockResolvedValue([
      { title: "Cache Test", url: "https://example.com", content: "Content" },
    ]);

    const first = await service.search("cache test query");
    expect(first.provider).toBe("duckduckgo");
    expect(ddgSpy).toHaveBeenCalledTimes(1);

    const second = await service.search("cache test query");
    expect(second.provider).toBe("cache");
    expect(second.results).toHaveLength(1);
    // Ensure no additional network call was made
    expect(ddgSpy).toHaveBeenCalledTimes(1);
  });

  it("formats search results cleanly for the LLM prompt", () => {
    const formatted = service.formatForLLM({
      query: "Postgres hosting",
      provider: "duckduckgo",
      results: [
        {
          title: "Supabase Pricing",
          url: "https://supabase.com/pricing",
          content: "Managed Postgres starts at $25/month.",
        },
      ],
    });

    expect(formatted).toContain('Web Search Results for "Postgres hosting" (via duckduckgo):');
    expect(formatted).toContain('[1] "Supabase Pricing"');
    expect(formatted).toContain("URL: https://supabase.com/pricing");
    expect(formatted).toContain("Managed Postgres starts at $25/month.");
  });
});
