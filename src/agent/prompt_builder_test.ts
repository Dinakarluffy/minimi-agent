import { describe, it, expect, beforeEach } from "vitest";
import { PromptBuilder } from "./prompt_builder.js";
import { SqliteStore } from "../memory/sqlite_store.js";

describe("PromptBuilder", () => {
  let store: SqliteStore;
  let builder: PromptBuilder;
  const refDate = new Date("2026-11-11T12:00:00Z"); // Wednesday, Nov 11, 2026

  beforeEach(() => {
    store = new SqliteStore(":memory:");
    builder = new PromptBuilder(store);
  });

  it("builds a system prompt with exact temporal anchor", () => {
    const sysPrompt = builder.buildSystemInstruction(refDate);
    expect(sysPrompt).toContain("Wednesday");
    expect(sysPrompt).toContain("2026-11-11");
    expect(sysPrompt).toContain("November 11, 2026");
    expect(sysPrompt).toContain("web_search");
  });

  it("retrieves past context when user asks about a specific date (Nov 3 scenario)", () => {
    const pastDate = new Date("2026-11-03T15:00:00Z");
    store.saveMessage({
      sessionId: "session-old",
      role: "user",
      content: "What are the recommended vector databases for Mac?",
      timestamp: pastDate.toISOString(),
      createdAtEpoch: pastDate.getTime(),
    });

    store.saveMessage({
      sessionId: "session-old",
      role: "assistant",
      content: "Chroma and LanceDB are great embedded vector databases for Mac.",
      timestamp: pastDate.toISOString(),
      createdAtEpoch: pastDate.getTime() + 1000,
    });

    // Current query in a new session
    const { contents, retrievedContextCount } = builder.buildContents(
      "session-new",
      "What did I ask you on 3 November? Is your answer still correct today?",
      { referenceDate: refDate }
    );

    expect(retrievedContextCount).toBeGreaterThan(0);
    const lastUserMsg = contents[contents.length - 1];
    expect(lastUserMsg.parts[0].text).toContain("<retrieved_past_context>");
    expect(lastUserMsg.parts[0].text).toContain("What are the recommended vector databases for Mac?");
    expect(lastUserMsg.parts[0].text).toContain("Chroma and LanceDB");
  });

  it("retrieves past context when user references a past topic (CRM scenario)", () => {
    store.saveMessage({
      sessionId: "session-work",
      role: "user",
      content: "Let's shortlist 5 CRM tools: HubSpot, Pipedrive, Close, Zoho, and Salesforce.",
      timestamp: new Date("2026-11-09T09:00:00Z").toISOString(),
      createdAtEpoch: new Date("2026-11-09T09:00:00Z").getTime(),
    });

    const { contents } = builder.buildContents(
      "session-work-new",
      "Has any of the CRM tools changed pricing since then?",
      { referenceDate: refDate }
    );

    const lastUserMsg = contents[contents.length - 1];
    expect(lastUserMsg.parts[0].text).toContain("<retrieved_past_context>");
    expect(lastUserMsg.parts[0].text).toContain("HubSpot, Pipedrive, Close, Zoho, and Salesforce");
  });
});
