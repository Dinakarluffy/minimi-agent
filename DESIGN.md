# DESIGN.md — Architecture & Design Decisions

## 1. How It Works

The agent is built as a deterministic, type-safe ReAct loop on Node.js using TypeScript, Google Gemini (`gemini-2.5-flash`), and an embedded SQLite memory store. It exposes a single external tool: `web_search`.

```
                  ┌────────────────────────────────────────┐
                  │               User Input               │
                  └───────────────────┬────────────────────┘
                                      │
                                      ▼
               ┌──────────────────────────────────────────────┐
               │         Temporal Parser & Keyword Match      │
               └──────────────────────┬───────────────────────┘
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
              [Active Session Store]     [SQLite Memory Index]
                         │                         │
                         └────────────┬────────────┘
                                      ▼
               ┌──────────────────────────────────────────────┐
               │    PromptBuilder (Temporal Anchor Injection)  │
               └──────────────────────┬───────────────────────┘
                                      │
                                      ▼
┌───────────────────────► ┌──────────────────────┐
│                         │   Gemini 2.5 Flash   │ ◄─────────────────────────┐
│                         └───────────┬──────────┘                           │
│                                     │                                      │
│                [Function Call: web_search]                 [Text Response] │
│                                     │                                      │
│                                     ▼                                      │
│                         ┌──────────────────────┐                           │
│                         │   Query Sanitizer    │                           │
│                         └───────────┬──────────┘                           │
│                                     ▼                                      │
│                         ┌──────────────────────┐                           │
│                         │   TTL Memory Cache   │                           │
│                         └───────────┬──────────┘                           │
│                                     │                                      │
│                         ┌───────────┴───────────┐                          │
│                         ▼                       ▼                          │
│               [Primary: DuckDuckGo]      [Fallback: Bing HTML]             │
│                         │                       │                          │
│                         └───────────┬───────────┘                          │
│                                     │ (Optional fallback: Google Grounding)│
│                                     ▼                                      │
│                         ┌──────────────────────┐                           │
│                         │ Format & Token Clamp │ ──────────────────────────┘
│                         └──────────────────────┘
│
└────── Final Synthesized Output ──► Persist to DB ──► User UI / CLI
```

### The Core Flow:
1. **Temporal Anchoring & Memory Retrieval**: Every user turn is stamped with the exact reference timestamp and day of the week. Before sending context to the model, `temporal_parser.ts` detects relative dates (*"last Tuesday"*, *"since Monday"*, *"3 November"*) and extracts matching historical conversations from SQLite.
2. **Context Injection**: Relevant historical messages are prepended under `<retrieved_past_context>`, providing the LLM with exact prior statements (e.g., the 5 CRM tools shortlisted on Monday) without needing a separate memory tool.
3. **Tool Execution & Defensive Search**: When the agent calls `web_search(query)`, the query is sanitized, checked against an in-memory TTL cache, and dispatched through a **zero-key multi-tier search pipeline**:
   - **Primary Tier**: DuckDuckGo HTML extractor (zero API key, developer-accurate search results).
   - **Fallback Tier**: Bing HTML search scraper (zero API key, unmetered, decodes real destination URLs).
   - **Grounding Tier**: Google Search Grounding (uses existing Gemini API key as a zero-subscription fallback).
4. **Diffing & Synthesis**: The model receives the live web results, compares them against the retrieved past context, and produces a factual diff highlighting pricing changes or new releases.

---

## 2. Why We Built It This Way

* **Resilience Under Extreme Conditions**: Standard agent implementations crash when external search keys run out of quota (HTTP 429) or when third-party services fail. Our zero-key search architecture transparently waterfalls through DuckDuckGo, Bing, and Google Grounding, ensuring web search never breaks and evaluators never need paid search accounts.
* **Deterministic Temporal Awareness**: LLMs inherently struggle to ground relative dates like *"last Tuesday"* or *"since Monday"*. By explicitly resolving relative natural language dates into ISO-bounded timestamp ranges and indexing messages in SQLite, memory retrieval is 100% deterministic.
* **Strict 1-Tool Discipline**: The challenge specifically mandates: *"It has one tool: web search"*. Instead of polluting the tool namespace with `search_memory` or `get_history` tools that increase token latency and failure modes, memory retrieval is handled in the orchestrator pipeline.
* **Defensive Guardrails**: Includes a circuit-breaker (max 5 iterations), exponential backoff retries on LLM rate-limits, and input sanitization to prevent infinite tool loops or crashes on malformed model outputs.
* **Zero Framework Bloat**: Rather than importing heavy frameworks (LangChain/CrewAI), the loop is built with direct SDK calls and native TypeScript. Every decision is auditable, testable, and transparent.

---

## 3. What We Considered and Rejected

1. **Rejected LangChain / LlamaIndex**:
   - *Why*: Complex abstraction layers that obscure execution flow, introduce breaking API changes, and add significant bundle weight. Building our own ReAct loop gives us total control over circuit breaking, timeout handling, and test mocks.
2. **Rejected Third-Party Paid Search Subscriptions (External Paid Search APIs)**:
   - *Why*: Requiring reviewers to create third-party search accounts or input paid search API keys adds unnecessary reviewer friction and creates external quota points of failure. Our zero-API-key waterfall (DuckDuckGo $\rightarrow$ Bing $\rightarrow$ Google Grounding) operates completely out of the box with only a Gemini key.
3. **Rejected Vector Embeddings for Temporal Filtering**:
   - *Why*: Vector similarity search is notoriously bad at temporal filtering (e.g., distinguishing between *"3 November"* and *"4 November"*). Relational B-tree indexed timestamp filters in SQLite are exact, instantaneous, and deterministic.
4. **Rejected Ephemeral In-Memory Chat Storage**:
   - *Why*: Testing prompts like *"What did I ask you on 3 November?"* requires state across restarts and sessions. SQLite with Write-Ahead Logging (WAL) provides durable local persistence without requiring an external database server.

---

## 4. What We Would Do With Another Week

1. **Streaming Token Output (SSE)**: Implement Server-Sent Events from the agent loop to stream tool-call status and tokens in real-time, reducing perceived latency to <300ms.
2. **Automated Structured Entity Graph**: Extract entities (e.g., company names, pricing numbers) into a lightweight SQLite entity-relationship table during each turn, enabling automatic, instant SQL-level diffing before triggering web searches.
3. **Parallel Multi-Query Search**: For multi-entity comparison prompts (e.g., checking 5 CRM tools at once), dispatch parallel search queries across all entities simultaneously rather than sequentially.
4. **Continuous Benchmark Evaluation Harness**: Build an automated eval suite running against historical web snapshots to measure precision, hallucination rate, and temporal recall across varying date boundaries.
