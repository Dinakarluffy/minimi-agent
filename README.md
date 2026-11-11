# minimi Agent — Chat Agent with Web Search & Temporal Memory

> A resilient, type-safe chat agent with web search, temporal reasoning, and fallback search architecture built for the **minimi hiring challenge**.

---

## Quick Start

### 1. Installation
```bash
npm install
```

### 2. Configure Environment Variables
Copy the example environment file:
```bash
cp .env.example .env
```
Open `.env` and add your **Gemini API Key**:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
```
*(Get a free key in 30 seconds at [Google AI Studio](https://aistudio.google.com/app/apikey))*.

> **Note on Web Search:** Zero search subscriptions or extra API keys required. The agent automatically uses a resilient zero-key search pipeline (DuckDuckGo $\rightarrow$ Bing $\rightarrow$ Google Grounding).

### 3. Run the Agent
To start the web interface:
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser to chat with the agent and inspect live tool executions.

To run interactive chat in the terminal:
```bash
npm run dev:cli
```

---

## Running Tests

Run the full unit test suite (45 tests covering every module and edge case):
```bash
npm test
```

To watch tests during development:
```bash
npm run test:watch
```

---

## Core Benchmark Scenarios Tested

The agent includes dedicated integration tests for the challenge dataset prompts:

1. **CRM Shortlist & Pricing Diff Check**:
   > *"On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?"*
   - Retrieves the 5 shortlisted tools from past conversation memory.
   - Searches current pricing and updates on the live web.
   - Synthesizes a factual comparison highlighting diffs.

2. **Historical Date Query & Fact Verification**:
   > *"What did I ask you on 3 November? Is your answer still correct today?"*
   - Resolves the exact date window using `temporal_parser.ts`.
   - Retrieves past questions asked on that day.
   - Searches live sources to verify whether the previous answer remains accurate today.

3. **Temporal Relative Topic Check**:
   > *"Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?"*
   - Anchors "last Tuesday" relative to current time.
   - Fetches the Postgres hosting discussion from memory.
   - Checks current provider pricing and diffs.

---

## Architectural Highlights

* **Resilient Multi-Tier Search**:
  - `DuckDuckGo` (primary zero-key scraper) $\rightarrow$ `Bing Search` (fail-safe unmetered fallback) $\rightarrow$ `Google Grounding`.
  - Search never crashes even under rate limits, missing credentials, or anti-bot challenges.
* **Deterministic Temporal Anchoring**:
  - Automatically resolves relative dates (`"last Tuesday"`, `"since Monday"`, `"3 November"`) to exact ISO date bounds.
* **Embedded SQLite Persistence**:
  - Uses `better-sqlite3` with Write-Ahead Logging (WAL) for millisecond queries and zero-config persistence.
* **Defensive Guardrails**:
  - Hard circuit-breaker at 5 tool iterations per turn.
  - Query sanitization and token clamping to prevent context window overflow.
  - Exponential backoff on model rate limits.

---

## Architecture Documentation

See **[`DESIGN.md`](./DESIGN.md)** for detailed architecture specifications, rejected alternatives, and future roadmap.
