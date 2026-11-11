import { sanitizeSearchQuery } from "./query_sanitizer.js";
import { searchTavily } from "./tavily.js";
import { searchBing } from "./bing.js";
import { searchDuckDuckGo } from "./duckduckgo.js";
import { searchGoogleGrounding } from "./google_search.js";
import type { SearchResponse, SearchResultItem, SearchOptions } from "./types.js";

interface CacheEntry {
  response: SearchResponse;
  expiresAt: number;
}

export class SearchService {
  private tavilyApiKey?: string;
  private geminiApiKey?: string;
  private cache: Map<string, CacheEntry> = new Map();
  private cacheTtlMs: number;

  constructor(tavilyApiKey?: string, geminiApiKeyOrTtl?: string | number, cacheTtlMs?: number) {
    this.tavilyApiKey = typeof tavilyApiKey === "string" ? tavilyApiKey.trim() || undefined : undefined;
    if (typeof geminiApiKeyOrTtl === "number") {
      this.cacheTtlMs = geminiApiKeyOrTtl;
      this.geminiApiKey = undefined;
    } else {
      this.geminiApiKey = typeof geminiApiKeyOrTtl === "string" ? geminiApiKeyOrTtl.trim() || undefined : undefined;
      this.cacheTtlMs = cacheTtlMs || 5 * 60 * 1000;
    }
  }

  public setTavilyApiKey(key?: string): void {
    this.tavilyApiKey = key?.trim() || undefined;
  }

  public setGeminiApiKey(key?: string): void {
    this.geminiApiKey = key?.trim() || undefined;
  }

  /**
   * Resilient search orchestrator with sanitization, caching, and multi-tier fallback:
   * 1. Tavily API (if configured)
   * 2. Bing Search (Fast, unmetered, zero API key)
   * 3. DuckDuckGo (zero API key fallback)
   * 4. Google Search Grounding fallback
   */
  public async search(rawQuery: string, options: SearchOptions = {}): Promise<SearchResponse> {
    const sanitized = sanitizeSearchQuery(rawQuery);
    if (!sanitized.isValid) {
      return {
        query: rawQuery,
        provider: "fallback",
        results: [],
        error: sanitized.reason || "Invalid query",
      };
    }

    const queryKey = sanitized.sanitized.toLowerCase();
    const now = Date.now();

    // 1. Check TTL cache
    const cached = this.cache.get(queryKey);
    if (cached && cached.expiresAt > now) {
      return {
        ...cached.response,
        provider: "cache",
      };
    }

    let results: SearchResultItem[] = [];
    let provider: "tavily" | "bing" | "duckduckgo" | "google" | "fallback" = "fallback";
    let lastError: string | undefined;

    // 2. Tier 1: Try Tavily if configured
    if (this.tavilyApiKey) {
      try {
        results = await searchTavily(sanitized.sanitized, this.tavilyApiKey, options);
        if (results.length > 0) {
          provider = "tavily";
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    // 3. Tier 2: DuckDuckGo (Fast, direct, developer-accurate)
    if (results.length === 0) {
      try {
        results = await searchDuckDuckGo(sanitized.sanitized, options);
        if (results.length > 0) {
          provider = "duckduckgo";
        }
      } catch (ddgErr: unknown) {
        const ddgErrorMsg = ddgErr instanceof Error ? ddgErr.message : String(ddgErr);
        lastError = lastError ? `${lastError} | DuckDuckGo: ${ddgErrorMsg}` : ddgErrorMsg;
      }
    }

    // 4. Tier 3: Bing Search (Robust, unmetered fallback)
    if (results.length === 0) {
      try {
        results = await searchBing(sanitized.sanitized, options);
        if (results.length > 0) {
          provider = "bing";
        }
      } catch (bingErr: unknown) {
        const bingMsg = bingErr instanceof Error ? bingErr.message : String(bingErr);
        lastError = lastError ? `${lastError} | Bing: ${bingMsg}` : bingMsg;
      }
    }

    // 5. Tier 4: Google Search Grounding fallback
    if (results.length === 0 && this.geminiApiKey) {
      try {
        results = await searchGoogleGrounding(sanitized.sanitized, this.geminiApiKey, options);
        if (results.length > 0) {
          provider = "google";
        }
      } catch (googleErr: unknown) {
        const gMsg = googleErr instanceof Error ? googleErr.message : String(googleErr);
        lastError = lastError ? `${lastError} | Google: ${gMsg}` : gMsg;
      }
    }

    const response: SearchResponse = {
      query: sanitized.sanitized,
      provider,
      results,
      error: results.length === 0 && lastError ? lastError : undefined,
    };

    // Cache successful responses
    if (results.length > 0) {
      this.cache.set(queryKey, {
        response,
        expiresAt: now + this.cacheTtlMs,
      });
    }

    return response;
  }

  /**
   * Formats search results into a clean, concise string for the LLM prompt.
   */
  public formatForLLM(response: SearchResponse): string {
    if (response.results.length === 0) {
      if (response.error) {
        return `[Web Search for "${response.query}" failed: ${response.error}]`;
      }
      return `[Web Search for "${response.query}" returned 0 results.]`;
    }

    const formatted = response.results
      .map((item, index) => {
        const datePart = item.publishedDate ? ` (Date: ${item.publishedDate})` : "";
        return `[${index + 1}] "${item.title}"${datePart}\nURL: ${item.url}\nSummary: ${item.content}`;
      })
      .join("\n\n");

    return `Web Search Results for "${response.query}" (via ${response.provider}):\n\n${formatted}`;
  }

  public clearCache(): void {
    this.cache.clear();
  }
}
