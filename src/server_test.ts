import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "./server.js";
import type { Server } from "node:http";

describe("HTTP Server API", () => {
  let server: Server;
  const testPort = 3199;

  beforeAll(async () => {
    server = createServer();
    await new Promise<void>((resolve) => server.listen(testPort, resolve));
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("serves the web chat client on GET /", async () => {
    const res = await fetch(`http://localhost:${testPort}/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("minimi | Chat Agent with Web Search");
  });

  it("returns health info on GET /api/health", async () => {
    const res = await fetch(`http://localhost:${testPort}/api/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("healthy");
    expect(data.model).toBeDefined();
  });

  it("lists sessions on GET /api/sessions", async () => {
    const res = await fetch(`http://localhost:${testPort}/api/sessions`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
  });

  it("validates input on POST /api/chat with empty body", async () => {
    const res = await fetch(`http://localhost:${testPort}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "" }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe("Message is required");
  });
});
