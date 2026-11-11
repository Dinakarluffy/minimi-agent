import http from "node:http";
import { config } from "./config.js";
import { SqliteStore } from "./memory/sqlite_store.js";
import { SearchService } from "./tools/search_service.js";
import { GeminiClient } from "./llm/gemini_client.js";
import { AgentLoop } from "./agent/agent_loop.js";
import { generateChatTitle } from "./agent/title_generator.js";

// Initialize core services with multi-tier search fallback
const store = new SqliteStore(config.dbPath);
const searchService = new SearchService(config.tavilyApiKey, config.geminiApiKey);
const geminiClient = new GeminiClient(config.geminiApiKey, config.geminiModel);
const agent = new AgentLoop(store, searchService, geminiClient);

const HTML_CLIENT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>minimi | Chat Agent with Web Search</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-base: #090d16;
      --bg-surface: #0f172a;
      --bg-surface-elevated: #162035;
      --bg-surface-hover: #1e293b;
      --border-subtle: rgba(255, 255, 255, 0.08);
      --border-focus: rgba(99, 102, 241, 0.5);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --primary-glow: rgba(99, 102, 241, 0.25);
      --emerald: #10b981;
      --emerald-glow: rgba(16, 185, 129, 0.15);
      --amber: #f59e0b;
      --sidebar-width: 280px;
      --header-height: 64px;
      --radius-sm: 8px;
      --radius-md: 12px;
      --radius-lg: 16px;
      --radius-full: 9999px;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: var(--bg-base);
      color: var(--text-main);
      height: 100vh;
      height: 100dvh;
      display: flex;
      overflow: hidden;
      -webkit-font-smoothing: antialiased;
    }

    /* Backdrop overlay for mobile drawer */
    #backdrop {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      z-index: 40;
      opacity: 0;
      transition: opacity 0.25s ease;
    }

    /* Sidebar Navigation */
    #sidebar {
      width: var(--sidebar-width);
      background: var(--bg-surface);
      border-right: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      z-index: 50;
      transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .sidebar-header {
      padding: 1.25rem 1.25rem 1rem 1.25rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border-subtle);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      font-weight: 700;
      font-size: 1.05rem;
      letter-spacing: -0.02em;
      color: var(--text-main);
    }

    .brand-icon {
      width: 28px;
      height: 28px;
      border-radius: var(--radius-sm);
      background: linear-gradient(135deg, #6366f1, #a855f7);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
      box-shadow: 0 0 16px var(--primary-glow);
    }

    .btn-new-chat {
      margin: 1rem 1.25rem 0.5rem 1.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: var(--primary);
      color: #ffffff;
      border: none;
      border-radius: var(--radius-md);
      font-size: 0.9rem;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 14px var(--primary-glow);
      transition: all 0.15s ease;
    }
    .btn-new-chat:hover {
      background: var(--primary-hover);
      transform: translateY(-1px);
    }

    .session-list-header {
      padding: 1rem 1.25rem 0.4rem 1.25rem;
      font-size: 0.72rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-dim);
    }

    #session-list {
      flex: 1;
      overflow-y: auto;
      padding: 0 0.75rem 1rem 0.75rem;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .session-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.65rem 0.8rem;
      border-radius: var(--radius-sm);
      font-size: 0.85rem;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.15s ease;
      position: relative;
    }

    .session-item:hover {
      background: var(--bg-surface-hover);
      color: var(--text-main);
    }

    .session-item.active {
      background: var(--bg-surface-elevated);
      color: var(--text-main);
      font-weight: 600;
      border: 1px solid var(--border-subtle);
    }

    .session-title-text {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
      padding-right: 0.5rem;
    }

    .session-delete-btn {
      opacity: 0;
      background: transparent;
      border: none;
      color: var(--text-dim);
      font-size: 1rem;
      cursor: pointer;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      transition: all 0.15s ease;
    }

    .session-item:hover .session-delete-btn {
      opacity: 1;
    }

    .session-delete-btn:hover {
      color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
    }

    .sidebar-footer {
      padding: 1rem 1.25rem;
      border-top: 1px solid var(--border-subtle);
      font-size: 0.75rem;
      color: var(--text-dim);
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
    }

    /* Main Container */
    #main {
      flex: 1;
      display: flex;
      flex-direction: column;
      height: 100%;
      position: relative;
      background: radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.05) 0%, transparent 60%);
    }

    /* Top Bar */
    #header {
      height: var(--header-height);
      padding: 0 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border-subtle);
      background: rgba(15, 23, 42, 0.7);
      backdrop-filter: blur(12px);
      z-index: 10;
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 1rem;
      overflow: hidden;
    }

    #btn-toggle-menu {
      display: none;
      background: transparent;
      border: 1px solid var(--border-subtle);
      color: var(--text-main);
      padding: 0.45rem 0.65rem;
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: 1.1rem;
    }

    #active-session-title {
      font-size: 0.95rem;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .badge-status {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.3rem 0.75rem;
      border-radius: var(--radius-full);
      background: var(--emerald-glow);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .badge-status .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 8px #10b981;
    }

    /* Messages Scroll Area */
    #messages-wrapper {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem 1rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      scroll-behavior: smooth;
    }

    #messages {
      width: 100%;
      max-width: 820px;
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .msg-group {
      display: flex;
      gap: 0.85rem;
      width: 100%;
      animation: fadeIn 0.25s ease-out forwards;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .msg-group.user {
      justify-content: flex-end;
    }

    .avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      font-weight: 700;
      flex-shrink: 0;
      margin-top: 0.2rem;
    }

    .msg-group.assistant .avatar {
      background: linear-gradient(135deg, #6366f1, #a855f7);
      color: white;
      box-shadow: 0 0 12px var(--primary-glow);
    }

    .msg-group.user .avatar {
      display: none;
    }

    .msg-bubble {
      max-width: 85%;
      border-radius: var(--radius-lg);
      padding: 0.9rem 1.25rem;
      font-size: 0.93rem;
      line-height: 1.6;
      word-break: break-word;
    }

    .msg-group.user .msg-bubble {
      background: linear-gradient(135deg, #4f46e5, #4338ca);
      color: #ffffff;
      border-bottom-right-radius: 4px;
      box-shadow: 0 4px 16px rgba(79, 70, 229, 0.25);
    }

    .msg-group.assistant .msg-bubble {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-bottom-left-radius: 4px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
      color: var(--text-main);
      width: 100%;
    }

    .msg-time {
      font-size: 0.7rem;
      color: var(--text-dim);
      margin-bottom: 0.4rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    /* Live Tool Inspection Pill */
    .tool-execution-pill {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      background: rgba(99, 102, 241, 0.1);
      border: 1px solid rgba(99, 102, 241, 0.3);
      padding: 0.4rem 0.75rem;
      border-radius: var(--radius-sm);
      font-size: 0.8rem;
      color: #818cf8;
      font-family: 'JetBrains Mono', monospace;
      margin: 0.5rem 0;
      width: fit-content;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .tool-execution-pill.success {
      background: rgba(16, 185, 129, 0.1);
      border-color: rgba(16, 185, 129, 0.3);
      color: #34d399;
    }

    /* Markdown Styling inside bubbles */
    .msg-content p { margin-bottom: 0.75rem; }
    .msg-content p:last-child { margin-bottom: 0; }
    .msg-content ul, .msg-content ol { margin: 0.5rem 0 0.75rem 1.25rem; }
    .msg-content li { margin-bottom: 0.35rem; }
    .msg-content strong { color: #ffffff; font-weight: 600; }
    .msg-content a {
      color: #818cf8;
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .msg-content a:hover { color: #a5b4fc; }
    .msg-content code {
      font-family: 'JetBrains Mono', monospace;
      background: rgba(255, 255, 255, 0.08);
      padding: 0.15rem 0.4rem;
      border-radius: 4px;
      font-size: 0.85em;
    }
    .msg-content pre {
      background: #020617;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      padding: 0.85rem;
      overflow-x: auto;
      margin: 0.75rem 0;
    }
    .msg-content pre code {
      background: transparent;
      padding: 0;
    }

    /* Bottom Input Bar */
    #input-area {
      padding: 1rem 1.5rem 1.5rem 1.5rem;
      background: rgba(15, 23, 42, 0.8);
      backdrop-filter: blur(16px);
      border-top: 1px solid var(--border-subtle);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
    }

    .input-box-wrapper {
      width: 100%;
      max-width: 820px;
      position: relative;
    }

    #chat-form {
      display: flex;
      align-items: flex-end;
      background: var(--bg-surface-elevated);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-lg);
      padding: 0.5rem 0.75rem 0.5rem 1.25rem;
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
      transition: all 0.2s ease;
    }

    #chat-form:focus-within {
      border-color: var(--primary);
      box-shadow: 0 0 0 2px var(--primary-glow), 0 8px 30px rgba(0, 0, 0, 0.4);
    }

    #prompt-input {
      flex: 1;
      background: transparent;
      border: none;
      color: var(--text-main);
      font-family: inherit;
      font-size: 0.95rem;
      line-height: 1.5;
      resize: none;
      max-height: 160px;
      padding: 0.4rem 0;
      outline: none;
    }

    #btn-send {
      width: 38px;
      height: 38px;
      border-radius: var(--radius-md);
      background: var(--primary);
      color: #ffffff;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      transition: all 0.15s ease;
      margin-left: 0.5rem;
    }

    #btn-send:hover {
      background: var(--primary-hover);
      transform: scale(1.04);
    }

    #btn-send:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none;
    }

    /* Suggestion Chips */
    .chip-container {
      display: flex;
      gap: 0.5rem;
      width: 100%;
      max-width: 820px;
      overflow-x: auto;
      padding-bottom: 0.25rem;
      scrollbar-width: none;
    }
    .chip-container::-webkit-scrollbar { display: none; }

    .chip {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border-subtle);
      color: var(--text-muted);
      padding: 0.35rem 0.8rem;
      border-radius: var(--radius-full);
      font-size: 0.78rem;
      font-weight: 500;
      white-space: nowrap;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .chip:hover {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-main);
      border-color: rgba(255, 255, 255, 0.18);
      transform: translateY(-1px);
    }

    /* Loading Pulse Animation */
    .typing-indicator {
      display: flex;
      gap: 5px;
      padding: 0.5rem 0.2rem;
    }
    .typing-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #818cf8;
      animation: pulse 1.4s infinite ease-in-out both;
    }
    .typing-dot:nth-child(1) { animation-delay: -0.32s; }
    .typing-dot:nth-child(2) { animation-delay: -0.16s; }

    @keyframes pulse {
      0%, 80%, 100% { transform: scale(0); opacity: 0.4; }
      40% { transform: scale(1); opacity: 1; }
    }

    /* Responsive Breakpoints: Tablet & Mobile */
    @media (max-width: 768px) {
      #backdrop { display: block; }
      #sidebar {
        position: fixed;
        top: 0;
        bottom: 0;
        left: 0;
        transform: translateX(-100%);
        box-shadow: 10px 0 30px rgba(0, 0, 0, 0.5);
      }
      #sidebar.open {
        transform: translateX(0);
      }
      #btn-toggle-menu { display: block; }
      #header { padding: 0 1rem; }
      #messages-wrapper { padding: 1rem 0.75rem; }
      .msg-bubble { max-width: 92%; }
      #input-area { padding: 0.75rem 1rem 1rem 1rem; }
    }
  </style>
</head>
<body>
  <div id="backdrop" onclick="toggleSidebar(false)"></div>

  <!-- Sidebar -->
  <aside id="sidebar">
    <div class="sidebar-header">
      <div class="brand">
        <div class="brand-icon">✦</div>
        <span>minimi</span>
      </div>
    </div>

    <button class="btn-new-chat" id="btn-new-chat" onclick="startNewChat()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      <span>New Chat</span>
    </button>

    <div class="session-list-header">Conversations</div>
    <ul id="session-list"></ul>

    <div class="sidebar-footer">
      <div><strong>Tool:</strong> web_search (Google Index)</div>
      <div><strong>Memory:</strong> SQLite WAL (Temporal)</div>
    </div>
  </aside>

  <!-- Main Chat Section -->
  <main id="main">
    <header id="header">
      <div class="header-left">
        <button id="btn-toggle-menu" onclick="toggleSidebar()" aria-label="Toggle Menu">☰</button>
        <span id="active-session-title">New Conversation</span>
      </div>
      <div>
        <span class="badge-status">
          <span class="dot"></span>
          <span>Online</span>
        </span>
      </div>
    </header>

    <div id="messages-wrapper">
      <div id="messages">
        <div class="msg-group assistant">
          <div class="avatar">✦</div>
          <div class="msg-bubble">
            <div class="msg-time">minimi agent • System Ready</div>
            <div class="msg-content">
              <p>Hello! I am your AI assistant equipped with real-time web search and temporal memory. I can search the live web, track pricing, and remember past conversations. How can I assist you today?</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <footer id="input-area">
      <div class="chip-container">
        <button class="chip" onclick="applySample('What is the current stable release of Next.js and Node.js today?')">Next.js & Node.js Releases</button>
        <button class="chip" onclick="applySample('On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?')">CRM Pricing Diff</button>
        <button class="chip" onclick="applySample('What did I ask you on 3 November? Is your answer still correct today?')">3 Nov Verification</button>
        <button class="chip" onclick="applySample('Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?')">Postgres Hosting</button>
      </div>

      <div class="input-box-wrapper">
        <form id="chat-form" onsubmit="event.preventDefault(); submitPrompt(); return false;">
          <textarea id="prompt-input" rows="1" placeholder="Ask anything, compare pricing, or query past days..." autocomplete="off"></textarea>
          <button id="btn-send" type="button" onclick="submitPrompt()" aria-label="Send">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
        </form>
      </div>
    </footer>
  </main>

  <script>
    let currentSessionId = "session-" + Date.now();
    const messagesContainer = document.getElementById("messages");
    const messagesWrapper = document.getElementById("messages-wrapper");
    const inputEl = document.getElementById("prompt-input");
    const btnSend = document.getElementById("btn-send");
    const sessionListEl = document.getElementById("session-list");
    const sessionTitleEl = document.getElementById("active-session-title");
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("backdrop");

    // Auto-resizing textarea
    inputEl.addEventListener("input", function() {
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 160) + "px";
    });

    // Enter to submit, Shift+Enter for new line
    inputEl.addEventListener("keydown", function(e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitPrompt();
      }
    });

    function toggleSidebar(forceState) {
      const isOpen = forceState !== undefined ? forceState : !sidebar.classList.contains("open");
      sidebar.classList.toggle("open", isOpen);
      backdrop.style.display = isOpen ? "block" : "none";
      setTimeout(() => { backdrop.style.opacity = isOpen ? "1" : "0"; }, 10);
    }

    function applySample(text) {
      inputEl.value = text;
      inputEl.focus();
      inputEl.style.height = "auto";
      inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + "px";
    }

    // Markdown Parser with Code Block & Link Support
    function formatMarkdown(text) {
      if (!text) return "";
      let html = text
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/\`\`\`([a-z0-9]*)\n([\\s\\S]*?)\`\`\`/g, (m, lang, code) => {
          return '<pre><code>' + code + '</code></pre>';
        })
        .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
        .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
        .replace(/\\*(.*?)\\*/g, '<em>$1</em>')
        .replace(/\\[([^\\]]+)\\]\\((https?:\\/\\/[^\\s\\)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        .replace(/^(?:\\*|\\-)\\s+(.*)$/gm, '<li>$1</li>');

      html = html.replace(/(<li>.*<\\/li>)/s, '<ul>$1</ul>');
      return html.split(/\\n\\n+/).map(p => {
        if (p.startsWith('<pre') || p.startsWith('<ul') || p.startsWith('<h')) return p;
        return '<p>' + p.replace(/\\n/g, '<br>') + '</p>';
      }).join('');
    }

    async function loadSessions() {
      try {
        const res = await fetch("/api/sessions");
        const sessions = await res.json();
        sessionListEl.innerHTML = "";
        sessions.forEach(s => {
          const li = document.createElement("li");
          li.className = "session-item" + (s.id === currentSessionId ? " active" : "");

          const titleSpan = document.createElement("span");
          titleSpan.className = "session-title-text";
          titleSpan.textContent = s.title || "New Chat";
          li.appendChild(titleSpan);

          const delBtn = document.createElement("button");
          delBtn.className = "session-delete-btn";
          delBtn.innerHTML = "×";
          delBtn.title = "Delete conversation";
          delBtn.onclick = (e) => {
            e.stopPropagation();
            deleteSession(s.id);
          };
          li.appendChild(delBtn);

          li.onclick = () => selectSession(s.id, s.title);
          sessionListEl.appendChild(li);
        });
      } catch (e) {
        console.error("Failed to load sessions:", e);
      }
    }

    async function selectSession(sId, title) {
      currentSessionId = sId;
      sessionTitleEl.textContent = title || "New Conversation";
      toggleSidebar(false);
      loadSessions();
      messagesContainer.innerHTML = "";

      try {
        const res = await fetch("/api/sessions/" + sId);
        const messages = await res.json();
        if (messages && messages.length > 0) {
          messages.forEach(m => appendMessage(m.role, m.content, m.timestamp));
        } else {
          appendMessage("assistant", "Session loaded. Ask anything!");
        }
      } catch (e) {
        appendMessage("assistant", "Failed to load session history.");
      }
    }

    async function deleteSession(sId) {
      if (!confirm("Delete this conversation?")) return;
      try {
        await fetch("/api/sessions/" + sId, { method: "DELETE" });
        if (currentSessionId === sId) {
          startNewChat();
        } else {
          loadSessions();
        }
      } catch (e) {
        console.error("Delete failed:", e);
      }
    }

    function startNewChat() {
      currentSessionId = "session-" + Date.now();
      sessionTitleEl.textContent = "New Conversation";
      messagesContainer.innerHTML = "";
      appendMessage("assistant", "Started a new conversation. What would you like to explore?");
      toggleSidebar(false);
      loadSessions();
    }

    function appendMessage(role, text, timeStr, steps) {
      const group = document.createElement("div");
      group.className = "msg-group " + role;

      if (role === "assistant") {
        const av = document.createElement("div");
        av.className = "avatar";
        av.textContent = "✦";
        group.appendChild(av);
      }

      const bubble = document.createElement("div");
      bubble.className = "msg-bubble";

      const timeHeader = document.createElement("div");
      timeHeader.className = "msg-time";
      timeHeader.textContent = (role === "user" ? "You" : "minimi agent") + (timeStr ? " • " + new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : " • Just now");
      bubble.appendChild(timeHeader);

      // Tool call pills
      if (steps && steps.length > 0) {
        steps.forEach(st => {
          if (st.type === "tool_call") {
            const pill = document.createElement("div");
            pill.className = "tool-execution-pill";
            pill.innerHTML = "🔍 web_search: \\"" + (st.query || "") + "\\"";
            bubble.appendChild(pill);
          }
        });
      }

      const content = document.createElement("div");
      content.className = "msg-content";
      content.innerHTML = role === "user" ? text.replace(/\\n/g, "<br>") : formatMarkdown(text);
      bubble.appendChild(content);

      group.appendChild(bubble);
      messagesContainer.appendChild(group);
      messagesWrapper.scrollTop = messagesWrapper.scrollHeight;
    }

    async function submitPrompt() {
      const text = inputEl.value.trim();
      if (!text) return;

      appendMessage("user", text);
      inputEl.value = "";
      inputEl.style.height = "auto";
      btnSend.disabled = true;

      // Loading bubble
      const loadingGroup = document.createElement("div");
      loadingGroup.className = "msg-group assistant";
      loadingGroup.id = "temp-loading";
      loadingGroup.innerHTML = \`
        <div class="avatar">✦</div>
        <div class="msg-bubble">
          <div class="msg-time">minimi agent • Searching &amp; Synthesizing...</div>
          <div class="typing-indicator">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
          </div>
        </div>
      \`;
      messagesContainer.appendChild(loadingGroup);
      messagesWrapper.scrollTop = messagesWrapper.scrollHeight;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: currentSessionId, message: text }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Server error HTTP " + res.status);
        }
        const data = await res.json();
        loadingGroup.remove();

        if (data.sessionTitle) {
          sessionTitleEl.textContent = data.sessionTitle;
        }

        appendMessage("assistant", data.reply, new Date().toISOString(), data.steps);
        loadSessions();
      } catch (err) {
        loadingGroup.remove();
        appendMessage("assistant", "Error: " + err.message);
      } finally {
        btnSend.disabled = false;
        inputEl.focus();
      }
    }

    loadSessions();
  </script>
</body>
</html>
`;

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
    console.log(`• Search: Multi-tier (Tavily -> Google Search Grounding -> DuckDuckGo)`);
    console.log(`• Memory: SQLite WAL (${config.dbPath})`);
    console.log(`======================================================\n`);
  });
}
