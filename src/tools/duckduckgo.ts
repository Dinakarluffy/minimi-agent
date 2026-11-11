import type { SearchResultItem, SearchOptions } from "./types.js";

/**
 * Cleanly unescapes common HTML entities without needing heavy DOM libraries.
 */
function decodeHtml(html: string): string {
  return html
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resilient zero-API-key web search using DuckDuckGo HTML endpoint.
 */
export async function searchDuckDuckGo(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResultItem[]> {
  const maxResults = options.maxResults || 5;
  const timeoutMs = options.timeoutMs || 8000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Upgrade-Insecure-Requests": "1",
        },
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      throw new Error(`DuckDuckGo returned status ${response.status}`);
    }

    const html = await response.text();
    const results: SearchResultItem[] = [];

    const rawBlocks = html.split(/class="[^"]*web-result[^"]*"/);
    const candidateBlocks =
      rawBlocks.length > 1
        ? rawBlocks.slice(1)
        : html.split(/class="[^"]*result[^"]*results_links/);

    for (const block of candidateBlocks) {
      if (results.length >= maxResults) break;

      const linkMatch =
        block.match(/<a[^>]*class="[^"]*result__url[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/s) ||
        block.match(/<a[^>]*href="([^"]+)"[^>]*class="[^"]*result__url[^"]*"[^>]*>(.*?)<\/a>/s) ||
        block.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/s);

      const snippetMatch =
        block.match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/) ||
        block.match(/<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/);

      if (linkMatch) {
        let rawUrl = linkMatch[1];
        if (rawUrl.includes("uddg=")) {
          const matchUddg = rawUrl.match(/uddg=([^&"]+)/);
          if (matchUddg) {
            rawUrl = decodeURIComponent(matchUddg[1]);
          }
        } else if (rawUrl.startsWith("//")) {
          rawUrl = "https:" + rawUrl;
        }

        const title = decodeHtml(linkMatch[2] || "Result");
        const content = snippetMatch ? decodeHtml(snippetMatch[1]) : title;

        if (rawUrl.startsWith("http") && content.length > 0) {
          results.push({
            title,
            url: rawUrl,
            content,
          });
        }
      }
    }

    return results;
  } finally {
    clearTimeout(timer);
  }
}
