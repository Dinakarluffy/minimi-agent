import { describe, it, expect, vi } from "vitest";
import { searchGoogleGrounding } from "./google_search.js";

describe("searchGoogleGrounding", () => {
  it("rejects immediately if API key is missing", async () => {
    await expect(searchGoogleGrounding("test", "")).rejects.toThrow("Gemini API key is missing");
  });

  it("parses valid Google Search grounding response", async () => {
    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: "Next.js stable release is 16.4.6 and Node.js is 24 LTS." }],
          },
          groundingMetadata: {
            groundingChunks: [
              { web: { title: "Next.js Blog", uri: "https://nextjs.org/blog" } },
              { web: { title: "Node.js Releases", uri: "https://nodejs.org/en/about/releases" } },
            ],
          },
        },
      ],
    };

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    try {
      const results = await searchGoogleGrounding("Next.js release", "test-key");
      expect(results).toHaveLength(2);
      expect(results[0].title).toBe("Next.js Blog");
      expect(results[0].url).toBe("https://nextjs.org/blog");
      expect(results[1].url).toBe("https://nodejs.org/en/about/releases");
    } finally {
      global.fetch = originalFetch;
    }
  });
});
