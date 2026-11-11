export interface SearchResultItem {
  title: string;
  url: string;
  content: string;
  publishedDate?: string;
}

export interface SearchResponse {
  query: string;
  provider: "tavily" | "duckduckgo" | "cache" | "fallback";
  results: SearchResultItem[];
  error?: string;
}

export interface SearchOptions {
  maxResults?: number;
  timeoutMs?: number;
}
