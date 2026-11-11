import { describe, it, expect, vi } from "vitest";
import { searchBing } from "./bing.js";

describe("searchBing", () => {
  it("parses mock Bing HTML correctly and decodes destination URLs", async () => {
    // Encoded destination: https://nodejs.org/en/about
    const encodedUrl = Buffer.from("https://nodejs.org/en/about").toString("base64");
    const mockHtml = `
      <ol id="b_results">
        <li class="b_algo">
          <h2><a href="https://www.bing.com/ck/a?!&amp;&amp;p=123&amp;u=a1${encodedUrl}&amp;ntb=1">Node.js Releases</a></h2>
          <div class="b_caption"><p>Node.js is an open-source, cross-platform JavaScript runtime environment.</p></div>
        </li>
      </ol>
    `;

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockHtml,
    } as Response);

    try {
      const results = await searchBing("Node.js releases", { maxResults: 5 });
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Node.js Releases");
      expect(results[0].url).toBe("https://nodejs.org/en/about");
      expect(results[0].content).toContain("Node.js is an open-source");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("handles network failure gracefully by throwing error", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error("Bing network failure"));

    try {
      await expect(searchBing("test")).rejects.toThrow("Bing network failure");
    } finally {
      global.fetch = originalFetch;
    }
  });
});
