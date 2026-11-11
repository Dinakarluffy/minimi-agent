import { describe, it, expect } from "vitest";
import { GeminiClient, WEB_SEARCH_TOOL_DECLARATION } from "./gemini_client.js";

describe("GeminiClient", () => {
  it("throws clear helpful error when GEMINI_API_KEY is not configured", async () => {
    const client = new GeminiClient("");
    await expect(client.generate([{ role: "user", parts: [{ text: "Hello" }] }])).rejects.toThrow(
      "GEMINI_API_KEY is not configured"
    );
  });

  it("verifies the web_search tool declaration schema adheres to Gemini specifications", () => {
    const decl = WEB_SEARCH_TOOL_DECLARATION.functionDeclarations[0];
    expect(decl.name).toBe("web_search");
    expect(decl.description).toContain("Search the web");
    expect(decl.parameters.type).toBe("OBJECT");
    expect(decl.parameters.properties.query.type).toBe("STRING");
    expect(decl.parameters.required).toContain("query");
  });
});
