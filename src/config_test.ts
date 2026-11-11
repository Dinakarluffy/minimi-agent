import { describe, it, expect } from "vitest";
import { loadConfig } from "./config.js";

describe("loadConfig", () => {
  it("provides safe defaults when env is empty", () => {
    const conf = loadConfig({});
    expect(conf.geminiApiKey).toBe("");
    expect(conf.geminiModel).toBe("gemini-flash-lite-latest");
    expect(conf.port).toBe(3000);
    expect(conf.dbPath).toBe("data/agent.db");
  });

  it("parses valid env variables", () => {
    const conf = loadConfig({
      GEMINI_API_KEY: "test-key-123",
      GEMINI_MODEL: "gemini-1.5-pro",
      PORT: "8080",
      DB_PATH: ":memory:",
    });
    expect(conf.geminiApiKey).toBe("test-key-123");
    expect(conf.geminiModel).toBe("gemini-1.5-pro");
    expect(conf.port).toBe(8080);
    expect(conf.dbPath).toBe(":memory:");
  });

  it("handles malformed port gracefully", () => {
    const conf = loadConfig({
      PORT: "invalid-port",
    });
    expect(conf.port).toBe(3000);
  });
});
