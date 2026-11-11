import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteStore } from "./sqlite_store.js";

describe("SqliteStore", () => {
  let store: SqliteStore;

  beforeEach(() => {
    // In-memory isolated database for tests
    store = new SqliteStore(":memory:");
  });

  afterEach(() => {
    store.close();
  });

  it("creates, updates title, and deletes sessions", () => {
    const session = store.createSession("sess-1", "New Chat");
    expect(session.id).toBe("sess-1");
    expect(session.title).toBe("New Chat");

    store.updateSessionTitle("sess-1", "Next.js & Node.js Discussion");
    const updated = store.getSession("sess-1");
    expect(updated?.title).toBe("Next.js & Node.js Discussion");

    store.deleteSession("sess-1");
    expect(store.getSession("sess-1")).toBeNull();
  });

  it("saves and retrieves recent messages in order", () => {
    const sId = "sess-chat";
    store.saveMessage({
      sessionId: sId,
      role: "user",
      content: "Hello agent!",
      timestamp: new Date().toISOString(),
      createdAtEpoch: Date.now(),
    });

    store.saveMessage({
      sessionId: sId,
      role: "assistant",
      content: "Hello! How can I help you?",
      timestamp: new Date().toISOString(),
      createdAtEpoch: Date.now() + 10,
    });

    const messages = store.getRecentMessages(sId, 10);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toBe("Hello agent!");
    expect(messages[1].role).toBe("assistant");
    expect(messages[1].content).toBe("Hello! How can I help you?");
  });

  it("queries messages by date range (temporal lookup: Nov 3 scenario)", () => {
    const sId = "sess-temporal";
    // Target date: Nov 3, 2026
    const targetDate = new Date("2026-11-03T14:30:00Z");
    store.saveMessage({
      sessionId: sId,
      role: "user",
      content: "What are the best open-source LLM agents?",
      timestamp: targetDate.toISOString(),
      createdAtEpoch: targetDate.getTime(),
    });

    // Another date: Nov 5, 2026
    const otherDate = new Date("2026-11-05T10:00:00Z");
    store.saveMessage({
      sessionId: sId,
      role: "user",
      content: "Tell me a joke",
      timestamp: otherDate.toISOString(),
      createdAtEpoch: otherDate.getTime(),
    });

    // Query specifically for Nov 3
    const results = store.queryMessages({
      startDate: "2026-11-03T00:00:00.000Z",
      endDate: "2026-11-03T23:59:59.999Z",
    });

    expect(results).toHaveLength(1);
    expect(results[0].content).toBe("What are the best open-source LLM agents?");
  });

  it("queries messages by keyword (topic lookup: CRM and Postgres scenarios)", () => {
    const sId = "sess-crm";
    store.saveMessage({
      sessionId: sId,
      role: "user",
      content: "On Monday we shortlisted 5 CRM tools for a 20-person sales team.",
      timestamp: new Date().toISOString(),
      createdAtEpoch: Date.now(),
    });

    store.saveMessage({
      sessionId: sId,
      role: "user",
      content: "Last Tuesday I asked you about Postgres hosting.",
      timestamp: new Date().toISOString(),
      createdAtEpoch: Date.now() + 100,
    });

    const crmResults = store.queryMessages({ query: "CRM" });
    expect(crmResults).toHaveLength(1);
    expect(crmResults[0].content).toContain("CRM tools");

    const postgresResults = store.queryMessages({ query: "Postgres" });
    expect(postgresResults).toHaveLength(1);
    expect(postgresResults[0].content).toContain("Postgres hosting");
  });

  it("safely handles SQL injection attempts in query strings", () => {
    const injectionQuery = "'; DROP TABLE messages; --";
    const results = store.queryMessages({ query: injectionQuery });
    expect(Array.isArray(results)).toBe(true);

    // Verify messages table still exists
    expect(() => store.saveMessage({
      sessionId: "sess-safe",
      role: "user",
      content: "still alive",
      timestamp: new Date().toISOString(),
      createdAtEpoch: Date.now(),
    })).not.toThrow();
  });
});
