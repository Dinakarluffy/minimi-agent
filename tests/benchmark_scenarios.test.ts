import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentLoop } from "../src/agent/agent_loop.js";
import { SqliteStore } from "../src/memory/sqlite_store.js";
import { SearchService } from "../src/tools/search_service.js";
import type { LLMClientInterface, LLMResponse } from "../src/llm/types.js";

describe("Minimi Benchmark Scenarios", () => {
  let store: SqliteStore;
  let searchService: SearchService;
  // Test reference anchor date: Wednesday, Nov 11, 2026
  const refDate = new Date("2026-11-11T12:00:00Z");

  beforeEach(() => {
    store = new SqliteStore(":memory:");
    searchService = new SearchService();
  });

  it("Scenario 1: CRM tools shortlisted on Monday + pricing diff verification", async () => {
    // Past setup: On Monday (Nov 9, 2026), the user shortlisted 5 CRM tools
    const mondayDate = new Date("2026-11-09T10:00:00Z");
    const pastSession = "crm-session-1";

    store.saveMessage({
      sessionId: pastSession,
      role: "user",
      content: "We need to shortlist 5 CRM tools for a 20-person sales team. What are the best options?",
      timestamp: mondayDate.toISOString(),
      createdAtEpoch: mondayDate.getTime(),
    });

    store.saveMessage({
      sessionId: pastSession,
      role: "assistant",
      content: "For a 20-person sales team, here are 5 shortlisted CRM tools: HubSpot ($50/user/mo), Pipedrive ($39/user/mo), Close CRM ($59/user/mo), Zoho CRM ($35/user/mo), and Salesforce Starter ($25/user/mo).",
      timestamp: mondayDate.toISOString(),
      createdAtEpoch: mondayDate.getTime() + 1000,
    });

    // Mock search service returning simulated live pricing
    vi.spyOn(searchService, "search").mockResolvedValue({
      query: "HubSpot Pipedrive Close Zoho Salesforce CRM pricing updates November 2026",
      provider: "duckduckgo",
      results: [
        {
          title: "HubSpot CRM Pricing 2026",
          url: "https://hubspot.com/pricing",
          content: "HubSpot Sales Hub Pro now starts at $50/user/mo with no recent changes.",
        },
        {
          title: "Pipedrive Feature Release",
          url: "https://pipedrive.com/news",
          content: "Pipedrive launched AI smart summarize for email sync this week.",
        },
      ],
    });

    // Mock LLM that sees the retrieved context, triggers web search, then answers
    const mockLlm: LLMClientInterface = {
      generate: vi
        .fn()
        .mockResolvedValueOnce({
          functionCalls: [
            {
              name: "web_search",
              args: { query: "HubSpot Pipedrive Close Zoho Salesforce CRM pricing updates November 2026" },
            },
          ],
        } as LLMResponse)
        .mockResolvedValueOnce({
          text: "On Monday you shortlisted HubSpot, Pipedrive, Close, Zoho, and Salesforce. Checking today: None of the 5 tools have changed their base pricing, but Pipedrive just shipped an AI smart summarization feature for sales emails this week.",
        } as LLMResponse),
    };

    const loop = new AgentLoop(store, searchService, mockLlm);
    const result = await loop.run(
      "crm-session-2",
      "On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?",
      { referenceDate: refDate }
    );

    expect(result.reply).toContain("On Monday you shortlisted");
    expect(result.reply).toContain("HubSpot, Pipedrive, Close, Zoho, and Salesforce");
    expect(result.reply).toContain("Pipedrive");
    expect(result.iterations).toBe(2);
  });

  it("Scenario 2: Query asked on 3 November + validity verification today", async () => {
    // Past setup: On Nov 3, 2026, user asked about Python 3.13 release status
    const nov3Date = new Date("2026-11-03T14:00:00Z");
    const pastSession = "session-nov3";

    store.saveMessage({
      sessionId: pastSession,
      role: "user",
      content: "Is Python 3.13 officially released with free-threaded GIL support?",
      timestamp: nov3Date.toISOString(),
      createdAtEpoch: nov3Date.getTime(),
    });

    store.saveMessage({
      sessionId: pastSession,
      role: "assistant",
      content: "Yes, Python 3.13 was officially released in October 2024 with experimental free-threaded (no-GIL) mode support.",
      timestamp: nov3Date.toISOString(),
      createdAtEpoch: nov3Date.getTime() + 1000,
    });

    vi.spyOn(searchService, "search").mockResolvedValue({
      query: "Python 3.13 official release status",
      provider: "duckduckgo",
      results: [
        {
          title: "Python 3.13 Release Notes",
          url: "https://python.org",
          content: "Python 3.13 is current stable release.",
        },
      ],
    });

    const mockLlm: LLMClientInterface = {
      generate: vi
        .fn()
        .mockResolvedValueOnce({
          functionCalls: [
            {
              name: "web_search",
              args: { query: "Python 3.13 official release status" },
            },
          ],
        } as LLMResponse)
        .mockResolvedValueOnce({
          text: "On 3 November, you asked: 'Is Python 3.13 officially released with free-threaded GIL support?' Yes, my answer is still correct today: Python 3.13 is stable and includes experimental free-threading.",
        } as LLMResponse),
    };

    const loop = new AgentLoop(store, searchService, mockLlm);
    const result = await loop.run(
      "session-today",
      "What did I ask you on 3 November? Is your answer still correct today?",
      { referenceDate: refDate }
    );

    expect(result.reply).toContain("On 3 November, you asked");
    expect(result.reply).toContain("still correct today");
    expect(result.iterations).toBe(2);
  });

  it("Scenario 3: Postgres hosting asked last Tuesday + pricing check", async () => {
    // Past setup: On last Tuesday (Nov 3 or Nov 10 depending on refDate)
    const lastTuesdayDate = new Date("2026-11-10T16:00:00Z");
    const pastSession = "postgres-session";

    store.saveMessage({
      sessionId: pastSession,
      role: "user",
      content: "What are the pricing options for managed Postgres on Supabase and Neon?",
      timestamp: lastTuesdayDate.toISOString(),
      createdAtEpoch: lastTuesdayDate.getTime(),
    });

    store.saveMessage({
      sessionId: pastSession,
      role: "assistant",
      content: "Supabase Pro is $25/month. Neon has a free tier and Launch plan at $19/month.",
      timestamp: lastTuesdayDate.toISOString(),
      createdAtEpoch: lastTuesdayDate.getTime() + 1000,
    });

    vi.spyOn(searchService, "search").mockResolvedValue({
      query: "Supabase Neon Postgres pricing changes November 2026",
      provider: "duckduckgo",
      results: [
        {
          title: "Supabase Pricing",
          url: "https://supabase.com/pricing",
          content: "Supabase Pro plan remains $25/month.",
        },
      ],
    });

    const mockLlm: LLMClientInterface = {
      generate: vi
        .fn()
        .mockResolvedValueOnce({
          functionCalls: [
            {
              name: "web_search",
              args: { query: "Supabase Neon Postgres pricing changes November 2026" },
            },
          ],
        } as LLMResponse)
        .mockResolvedValueOnce({
          text: "Last Tuesday you asked about managed Postgres pricing on Supabase and Neon. I checked current rates: Pricing has not changed since last week—Supabase Pro remains $25/month and Neon Launch is $19/month.",
        } as LLMResponse),
    };

    const loop = new AgentLoop(store, searchService, mockLlm);
    const result = await loop.run(
      "postgres-session-2",
      "Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?",
      { referenceDate: refDate }
    );

    expect(result.reply).toContain("Last Tuesday you asked about managed Postgres pricing");
    expect(result.reply).toContain("Pricing has not changed");
    expect(result.iterations).toBe(2);
  });
});
