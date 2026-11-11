import type { SearchResultItem, SearchOptions } from "./types.js";

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
 * Extracts destination URL from Bing click-tracking link:
 * e.g. u=a1aHR0cHM6Ly9leGFtcGxlLmNvbQ==
 */
function extractBingDestinationUrl(rawUrl: string): string {
  try {
    const unescaped = rawUrl.replace(/&amp;/g, "&");
    const match = unescaped.match(/[?&]u=a1([^&]+)/);
    if (match) {
      // Base64url to standard base64
      let b64 = match[1].replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4 !== 0) {
        b64 += "=";
      }
      const decoded = Buffer.from(b64, "base64").toString("utf8");
      if (decoded.startsWith("http")) {
        return decoded;
      }
    }
  } catch {
    // Fall back to raw URL
  }
  return rawUrl.replace(/&amp;/g, "&");
}

/**
 * Resilient zero-API-key web search using Bing HTML endpoint.
 */
export async function searchBing(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResultItem[]> {
  const maxResults = options.maxResults || 5;
  const timeoutMs = options.timeoutMs || 8000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(
      `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=en`,
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
      throw new Error(`Bing returned status ${response.status}`);
    }

    const html = await response.text();
    const results: SearchResultItem[] = [];
    const blocks = html.split(/<li class="b_algo"/);

    for (let i = 1; i < blocks.length; i++) {
      if (results.length >= maxResults) break;
      const block = blocks[i];

      const linkMatch =
        block.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/s) ||
        block.match(/<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/s);

      const snippetMatch =
        block.match(/<div class="b_caption"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/s) ||
        block.match(/<p class="b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/p>/s) ||
        block.match(/<p[^>]*>([\s\S]*?)<\/p>/s);

      if (linkMatch) {
        const rawUrl = linkMatch[1];
        const title = decodeHtml(linkMatch[2] || "Result");
        const url = extractBingDestinationUrl(rawUrl);
        const snippetRaw = snippetMatch ? snippetMatch[1] : "";
        const content = decodeHtml(snippetRaw) || title;

        if (url.startsWith("http") && content.length > 0) {
          results.push({
            title,
            url,
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
