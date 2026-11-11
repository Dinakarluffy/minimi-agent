import http from "node:http";
import { config } from "./config.js";
import { SqliteStore } from "./memory/sqlite_store.js";
import { SearchService } from "./tools/search_service.js";
import { GeminiClient } from "./llm/gemini_client.js";
import { AgentLoop } from "./agent/agent_loop.js";

// Initialize core services
const store = new SqliteStore(config.dbPath);
const searchService = new SearchService(config.tavilyApiKey);
const geminiClient = new GeminiClient(config.geminiApiKey, config.geminiModel);
const agent = new AgentLoop(store, searchService, geminiClient);

const HTML_CLIENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>minimi | Chat Agent with Web Search</title>
  <style>
    :root {
      --bg: #0d1117;
      --surface: #161b22;
      --border: #30363d;
      --text: #c9d1d9;
      --text-bright: #f0f6fc;
      --text-dim: #8b949e;
      --accent: #238636;
      --accent-hover: #2ea043;
      --badge-tool: #1f6feb;
      --badge-search: #8957e5;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      height: 100vh;
      overflow: hidden;
    }
    #sidebar {
      width: 260px;
      background: var(--surface);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      padding: 1rem;
    }
    #sidebar h2 {
      font-size: 1.1rem;
      color: var(--text-bright);
      margin-bottom: 0.5rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    #sidebar .tag {
      font-size: 0.75rem;
      background: #21262d;
      color: #58a6ff;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      border: 1px solid #30363d;
    }
    .btn-new {
      background: var(--accent);
      color: #fff;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      margin: 1rem 0;
      transition: background 0.15s;
    }
    .btn-new:hover { background: var(--accent-hover); }
    #session-list {
      flex: 1;
      overflow-y: auto;
      list-style: none;
    }
    #session-list li {
      padding: 0.5rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.85rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-bottom: 0.25rem;
    }
    #session-list li.active, #session-list li:hover {
      background: #21262d;
      color: var(--text-bright);
    }
    #main {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: var(--bg);
    }
    #header {
      padding: 0.8rem 1.5rem;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.9rem;
    }
    #header .status-pill {
      font-size: 0.75rem;
      padding: 0.2rem 0.6rem;
      border-radius: 12px;
      background: #23863622;
      color: #3fb950;
      border: 1px solid #23863666;
    }
    #messages {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }
    .msg {
      max-width: 80%;
      line-height: 1.5;
      font-size: 0.95rem;
      word-break: break-word;
    }
    .msg.user {
      align-self: flex-end;
      background: #1f6feb22;
      border: 1px solid #1f6feb55;
      color: var(--text-bright);
      padding: 0.75rem 1rem;
      border-radius: 12px 12px 2px 12px;
    }
    .msg.assistant {
      align-self: flex-start;
      background: var(--surface);
      border: 1px solid var(--border);
      padding: 1rem 1.25rem;
      border-radius: 12px 12px 12px 2px;
    }
    .msg-header {
      font-size: 0.75rem;
      color: var(--text-dim);
      margin-bottom: 0.4rem;
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
    .tool-call-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      background: #388bfd1a;
      border: 1px solid #388bfd44;
      color: #58a6ff;
      padding: 0.25rem 0.5rem;
      border-radius: 6px;
      font-size: 0.75rem;
      margin: 0.3rem 0;
      font-family: monospace;
    }
    #input-container {
      padding: 1rem 1.5rem;
      background: var(--surface);
      border-top: 1px solid var(--border);
    }
    #form {
      display: flex;
      gap: 0.75rem;
    }
    #prompt-input {
      flex: 1;
      background: #0d1117;
      border: 1px solid var(--border);
      color: var(--text-bright);
      padding: 0.8rem 1rem;
      border-radius: 8px;
      font-size: 0.95rem;
      outline: none;
    }
    #prompt-input:focus { border-color: #58a6ff; }
    #btn-send {
      background: var(--accent);
      color: white;
      border: none;
      padding: 0 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
    }
    #btn-send:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .sample-prompts {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.6rem;
      flex-wrap: wrap;
    }
    .sample-chip {
      background: #21262d;
      border: 1px solid #30363d;
      font-size: 0.75rem;
      color: var(--text-dim);
      padding: 0.25rem 0.6rem;
      border-radius: 12px;
      cursor: pointer;
    }
    .sample-chip:hover {
      color: var(--text-bright);
      border-color: #8b949e;
    }
  </style>
</head>
<body>
  <div id="sidebar">
    <h2>minimi agent <span class="tag">AI</span></h2>
    <button class="btn-new" id="btn-new-chat">+ New Chat</button>
    <ul id="session-list"></ul>
    <div style="font-size: 0.75rem; color: var(--text-dim); margin-top: auto;">
      Tool: web_search (Tavily + DuckDuckGo fallback)<br>
      Memory: SQLite WAL
    </div>
  </div>

  <div id="main">
    <div id="header">
      <div>
        <strong id="active-session-title">New Conversation</strong>
      </div>
      <div>
        <span class="status-pill">● System Online</span>
      </div>
    </div>

    <div id="messages">
      <div class="msg assistant">
        <div class="msg-header">minimi agent • System ready</div>
        Hello! I am your research and conversational agent. I have live web search and persistent memory across past conversations and dates. How can I assist you today?
      </div>
    </div>

    <div id="input-container">
      <form id="form">
        <input id="prompt-input" type="text" placeholder="Ask a question, query past days, or research the web..." autocomplete="off" />
        <button id="btn-send" type="submit">Send</button>
      </form>
      <div class="sample-prompts">
        <span class="sample-chip" onclick="setPrompt('On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?')">CRM Shortlist Check</span>
        <span class="sample-chip" onclick="setPrompt('What did I ask you on 3 November? Is your answer still correct today?')">3 Nov Verification</span>
        <span class="sample-chip" onclick="setPrompt('Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?')">Postgres Pricing</span>
      </div>
    </div>
  </div>

  <script>
    let currentSessionId = "session-" + Date.now();
    const messagesEl = document.getElementById("messages");
    const inputEl = document.getElementById("prompt-input");
    const btnSend = document.getElementById("btn-send");
    const sessionListEl = document.getElementById("session-list");
    const sessionTitleEl = document.getElementById("active-session-title");

    function setPrompt(txt) {
      inputEl.value = txt;
      inputEl.focus();
    }

    async function loadSessions() {
      try {
        const res = await fetch("/api/sessions");
        const sessions = await res.json();
        sessionListEl.innerHTML = "";
        sessions.forEach(s => {
          const li = document.createElement("li");
          li.textContent = s.title || s.id;
          if (s.id === currentSessionId) li.classList.add("active");
          li.onclick = () => selectSession(s.id, s.title);
          sessionListEl.appendChild(li);
        });
      } catch (e) {
        console.error("Failed to load sessions:", e);
      }
    }

    async function selectSession(sId, title) {
      currentSessionId = sId;
      sessionTitleEl.textContent = title || sId;
      loadSessions();
      messagesEl.innerHTML = "";
      try {
        const res = await fetch("/api/sessions/" + sId);
        const data = await res.json();
        if (data && data.length > 0) {
          data.forEach(m => appendMessage(m.role, m.content, m.timestamp));
        } else {
          appendMessage("assistant", "Session loaded. Ask anything!");
        }
      } catch (e) {
        appendMessage("assistant", "Failed to load history.");
      }
    }

    document.getElementById("btn-new-chat").onclick = () => {
      currentSessionId = "session-" + Date.now();
      sessionTitleEl.textContent = "New Conversation";
      messagesEl.innerHTML = "";
      appendMessage("assistant", "Started a new conversation. What would you like to explore?");
      loadSessions();
    };

    function appendMessage(role, text, timeStr, steps) {
      const wrap = document.createElement("div");
      wrap.className = "msg " + role;
      
      const header = document.createElement("div");
      header.className = "msg-header";
      header.textContent = (role === "user" ? "You" : "minimi agent") + (timeStr ? " • " + new Date(timeStr).toLocaleTimeString() : " • Just now");
      wrap.appendChild(header);

      if (steps && steps.length > 0) {
        steps.forEach(st => {
          if (st.type === "tool_call") {
            const badge = document.createElement("div");
            badge.className = "tool-call-badge";
            badge.textContent = "🔍 web_search: \\"" + (st.query || "") + "\\"";
            wrap.appendChild(badge);
          }
        });
      }

      const body = document.createElement("div");
      body.style.whiteSpace = "pre-wrap";
      body.textContent = text;
      wrap.appendChild(body);

      messagesEl.appendChild(wrap);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    document.getElementById("form").onsubmit = async (e) => {
      e.preventDefault();
      const text = inputEl.value.trim();
      if (!text) return;

      appendMessage("user", text);
      inputEl.value = "";
      btnSend.disabled = true;

      // Temporary loading indicator
      const tempLoading = document.createElement("div");
      tempLoading.className = "msg assistant";
      tempLoading.id = "loading-indicator";
      tempLoading.textContent = "Searching & synthesizing...";
      messagesEl.appendChild(tempLoading);
      messagesEl.scrollTop = messagesEl.scrollHeight;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: currentSessionId, message: text }),
        });
        const data = await res.json();
        tempLoading.remove();
        appendMessage("assistant", data.reply, new Date().toISOString(), data.steps);
        loadSessions();
      } catch (err) {
        tempLoading.remove();
        appendMessage("assistant", "Error: " + err.message);
      } finally {
        btnSend.disabled = false;
      }
    };

    loadSessions();
  </script>
</body>
</html>
`;

export function createServer() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    // CORS Headers for API requests
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Serve Web UI
    if (url.pathname === "/" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(HTML_CLIENT);
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

    // Get Session Messages
    if (url.pathname.startsWith("/api/sessions/") && req.method === "GET") {
      const sId = url.pathname.replace("/api/sessions/", "");
      const messages = store.getRecentMessages(sId, 50);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(messages));
      return;
    }

    // Chat API
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

          const result = await agent.run(sessionId, message);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
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
    console.log(`• Search: ${config.tavilyApiKey ? "Tavily (Primary) + DuckDuckGo (Fallback)" : "DuckDuckGo (Zero-API-Key Fail-Safe)"}`);
    console.log(`• Memory: SQLite (${config.dbPath})`);
    console.log(`======================================================\n`);
  });
}
