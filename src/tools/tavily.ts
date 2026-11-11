import type { SearchResultItem, SearchOptions } from "./types.js";

export async function searchTavily(
  query: string,
  apiKey: string,
  options: SearchOptions = {}
): Promise<SearchResultItem[]> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("Tavily API key is missing");
  }

  const maxResults = options.maxResults || 5;
  const timeoutMs = options.timeoutMs || 8000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey.trim(),
        query,
        search_depth: "basic",
        include_answer: false,
        max_results: maxResults,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      throw new Error(`Tavily error HTTP ${response.status}: ${errBody}`);
    }

    const data = (await response.json()) as {
      results?: Array<{
        title?: string;
        url?: string;
        content?: string;
        published_date?: string;
      }>;
    };

    if (!data.results || !Array.isArray(data.results)) {
      return [];
    }

    return data.results.map((item) => ({
      title: item.title?.trim() || "Untitled Result",
      url: item.url?.trim() || "",
      content: item.content?.trim() || "",
      publishedDate: item.published_date?.trim(),
    })).filter((item) => item.url.startsWith("http"));
  } finally {
    clearTimeout(timer);
  }
}
