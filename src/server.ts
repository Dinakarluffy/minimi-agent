import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { SqliteStore } from "./memory/sqlite_store.js";
import { SearchService } from "./tools/search_service.js";
import { GeminiClient } from "./llm/gemini_client.js";
import { AgentLoop } from "./agent/agent_loop.js";
import { generateChatTitle } from "./agent/title_generator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getClientHtml(): string {
  const candidates = [
    path.join(process.cwd(), "src/public/index.html"),
    path.join(__dirname, "public/index.html"),
    path.join(__dirname, "../src/public/index.html"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, "utf-8");
    }
  }
  return "<!DOCTYPE html><html><body><h1>minimi agent UI</h1></body></html>";
}

// Initialize core services with multi-tier search fallback
const store = new SqliteStore(config.dbPath);
const searchService = new SearchService(config.geminiApiKey);
const geminiClient = new GeminiClient(config.geminiApiKey, config.geminiModel);
const agent = new AgentLoop(store, searchService, geminiClient);

export function createServer() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Serve Responsive Web UI
    if (url.pathname === "/" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(getClientHtml());
      return;
    }

    // Healthcheck
    if (url.pathname === "/api/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "healthy", model: config.geminiModel, db: config.dbPath }));
      return;
    }

    // List Sessions
    if (url.pathname === "/api/sessions" && req.method === "GET") {
      const sessions = store.listSessions();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(sessions));
      return;
    }

    // Delete Session
    if (url.pathname.startsWith("/api/sessions/") && req.method === "DELETE") {
      const sId = url.pathname.replace("/api/sessions/", "");
      store.deleteSession(sId);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // Get Session Messages
    if (url.pathname.startsWith("/api/sessions/") && req.method === "GET") {
      const sId = url.pathname.replace("/api/sessions/", "");
      const messages = store.getRecentMessages(sId, 50);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(messages));
      return;
    }

    // Chat API with Automatic Dynamic Title Generation
    if (url.pathname === "/api/chat" && req.method === "POST") {
      let bodyStr = "";
      req.on("data", (chunk) => {
        bodyStr += chunk;
      });

      req.on("end", async () => {
        try {
          const body = JSON.parse(bodyStr || "{}");
          const sessionId = body.sessionId || "default-session";
          const message = String(body.message || "").trim();

          if (!message) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Message is required" }));
            return;
          }

          // Check if session needs an AI-generated title (first message in session)
          const existingSession = store.getSession(sessionId);
          const isInitialTitle = !existingSession || existingSession.title === "New Chat" || existingSession.title === "New Conversation";

          let newTitle: string | undefined;
          if (isInitialTitle) {
            newTitle = await generateChatTitle(message, config.geminiApiKey);
            store.createSession(sessionId, newTitle);
          }

          const result = await agent.run(sessionId, message);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              ...result,
              sessionTitle: newTitle || existingSession?.title,
            })
          );
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: errMsg }));
        }
      });
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  });

  return server;
}

// Start server when run directly
if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) {
  const server = createServer();
  server.listen(config.port, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 minimi chat agent running at http://localhost:${config.port}`);
    console.log(`• Model: ${config.geminiModel}`);
    console.log(`• Search: Multi-tier Zero-Key (DuckDuckGo -> Bing -> Google Search Grounding)`);
    console.log(`• Memory: SQLite WAL (${config.dbPath})`);
    console.log(`======================================================\n`);
  });
}
