import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentLoop } from "./agent_loop.js";
import { SqliteStore } from "../memory/sqlite_store.js";
import { SearchService } from "../tools/search_service.js";
import type { LLMClientInterface, ContentItem, LLMResponse } from "../llm/types.js";

describe("AgentLoop", () => {
  let store: SqliteStore;
  let searchService: SearchService;

  beforeEach(() => {
    store = new SqliteStore(":memory:");
    searchService = new SearchService();
  });

  it("handles standard conversation without tool calls", async () => {
    const mockLlm: LLMClientInterface = {
      generate: vi.fn().mockResolvedValue({
        text: "Hello! I am ready to help you.",
      } as LLMResponse),
    };

    const loop = new AgentLoop(store, searchService, mockLlm);
    const result = await loop.run("sess-1", "Hi there!");

    expect(result.reply).toBe("Hello! I am ready to help you.");
    expect(result.iterations).toBe(1);

    // Verify messages stored in memory
    const history = store.getRecentMessages("sess-1");
    expect(history).toHaveLength(2);
    expect(history[0].role).toBe("user");
    expect(history[1].role).toBe("assistant");
  });

  it("executes web_search tool and feeds results back to LLM", async () => {
    // 1st turn: LLM requests web_search
    // 2nd turn: LLM receives search results and outputs answer
    const mockLlm: LLMClientInterface = {
      generate: vi
        .fn()
        .mockResolvedValueOnce({
          functionCalls: [
            {
              name: "web_search",
              args: { query: "Postgres hosting pricing changes 2026" },
            },
          ],
        } as LLMResponse)
        .mockResolvedValueOnce({
          text: "Based on recent search results, Supabase launched new compute tiers and Neon updated storage rates.",
        } as LLMResponse),
    };

    // Mock search service to return deterministic results
    vi.spyOn(searchService, "search").mockResolvedValue({
      query: "Postgres hosting pricing changes 2026",
      provider: "duckduckgo",
      results: [
        {
          title: "Postgres Hosting Comparison",
          url: "https://example.com/postgres",
          content: "Supabase and Neon updated their pricing tiers.",
        },
      ],
    });

    const loop = new AgentLoop(store, searchService, mockLlm);
    const stepsRecorded: any[] = [];

    const result = await loop.run("sess-2", "Has Postgres hosting pricing changed?", {
      onStep: (s) => stepsRecorded.push(s),
    });

    expect(result.reply).toContain("Supabase launched new compute tiers");
    expect(result.iterations).toBe(2);

    // Verify step callbacks fired
    const toolCall = stepsRecorded.find((s) => s.type === "tool_call");
    expect(toolCall).toBeDefined();
    expect(toolCall.tool).toBe("web_search");
    expect(toolCall.query).toBe("Postgres hosting pricing changes 2026");

    const toolResult = stepsRecorded.find((s) => s.type === "tool_result");
    expect(toolResult).toBeDefined();
    expect(toolResult.resultsCount).toBe(1);
  });

  it("triggers circuit breaker when model exceeds max iterations", async () => {
    // Model keeps returning tool calls endlessly
    const mockLlm: LLMClientInterface = {
      generate: vi.fn().mockResolvedValue({
        functionCalls: [{ name: "web_search", args: { query: "endless loop" } }],
      } as LLMResponse),
    };

    vi.spyOn(searchService, "search").mockResolvedValue({
      query: "endless loop",
      provider: "duckduckgo",
      results: [],
    });

    const loop = new AgentLoop(store, searchService, mockLlm);
    const result = await loop.run("sess-loop", "Infinite search test", {
      maxIterations: 3,
    });

    expect(result.iterations).toBe(3);
    expect(result.reply).toContain("maximum allowed tool iterations");
  });

  it("handles model error gracefully without crashing process", async () => {
    const mockLlm: LLMClientInterface = {
      generate: vi.fn().mockRejectedValue(new Error("API quota exceeded")),
    };

    const loop = new AgentLoop(store, searchService, mockLlm);
    const result = await loop.run("sess-err", "What is the weather?");

    expect(result.reply).toContain("API quota exceeded");
  });
});
