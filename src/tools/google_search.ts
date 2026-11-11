import type { SearchResultItem, SearchOptions } from "./types.js";

/**
 * Resilient web search utilizing Gemini's native Google Search grounding.
 * Provides live Google Search index results without requiring third-party search subscriptions.
 */
export async function searchGoogleGrounding(
  query: string,
  apiKey: string,
  options: SearchOptions = {}
): Promise<SearchResultItem[]> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("Gemini API key is missing for Google Search grounding");
  }

  const timeoutMs = options.timeoutMs || 10000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${encodeURIComponent(
      apiKey.trim()
    )}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Search the web and provide current facts, pricing, updates, and links for: "${query}". Be factual and concise.`,
              },
            ],
          },
        ],
        tools: [{ googleSearch: {} }],
        generationConfig: {
          temperature: 0.1,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(`Google Search Grounding failed (${response.status}): ${errText}`);
    }

    const data = (await response.json()) as any;
    const candidate = data.candidates?.[0];
    const textContent = candidate?.content?.parts?.[0]?.text || "";
    const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];

    const results: SearchResultItem[] = [];

    // Extract citations from groundingChunks
    for (const chunk of groundingChunks) {
      if (chunk.web?.uri) {
        results.push({
          title: chunk.web.title || "Web Search Result",
          url: chunk.web.uri,
          content: textContent.slice(0, 300),
        });
      }
    }

    // If groundingChunks was empty or sparse, provide the synthesized search summary as an item
    if (results.length === 0 && textContent.length > 10) {
      results.push({
        title: `Search Overview: ${query}`,
        url: "https://google.com/search?q=" + encodeURIComponent(query),
        content: textContent,
      });
    } else if (results.length > 0 && textContent.length > 10) {
      // Ensure the first item contains the synthesized text snippet
      results[0].content = textContent;
    }

    return results.slice(0, options.maxResults || 5);
  } finally {
    clearTimeout(timer);
  }
}
