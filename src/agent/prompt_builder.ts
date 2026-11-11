import { parseTemporalExpression } from "../memory/temporal_parser.js";
import type { SqliteStore } from "../memory/sqlite_store.js";
import type { MessageRecord } from "../memory/types.js";
import type { ContentItem } from "../llm/types.js";

export interface PromptContextOptions {
  referenceDate?: Date;
  historyLimit?: number;
}

export class PromptBuilder {
  private store: SqliteStore;

  constructor(store: SqliteStore) {
    this.store = store;
  }

  /**
   * Generates a grounded system instruction with accurate date anchoring and operational rules.
   */
  public buildSystemInstruction(referenceDate: Date = new Date()): string {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayName = days[referenceDate.getDay()];
    const isoDate = referenceDate.toISOString().split("T")[0];
    const fullDateStr = `${dayName}, ${isoDate} (${referenceDate.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    })})`;

    return `You are an intelligent, fact-grounded conversational agent with live web search capabilities.
Your primary strengths are temporal awareness, accurate memory recall, and live fact-checking.

Current Temporal Anchor:
- Today is: ${fullDateStr}
- Reference Timestamp: ${referenceDate.toISOString()}

Your Available Tools:
1. web_search(query: string): Search the live web for current facts, latest news, pricing changes, and documentation.

Operating Guidelines:
1. Always Use web_search for Current Facts: When asked about pricing, recent events, whether something has changed, or if a past answer is still true today, ALWAYS execute a web search. Never guess or rely solely on training data.
2. Temporal Grounding & Reasoning:
   - When the user refers to relative days ("on Monday", "last Tuesday", "since then", "yesterday", "3 November"), anchor them relative to today (${fullDateStr}).
   - If context from past conversations is provided in <retrieved_past_context>, use it to identify the exact entities, previous decisions, or questions discussed previously.
3. Diffing & Comparison:
   - If asked "Has any pricing changed since then?" or "Is your answer still correct today?", first identify what was stated in the past, then search the live web for the current state, and explicitly highlight what changed (or what remained the same).
4. Tone & Conciseness:
   - Answer directly, clearly, and concisely.
   - Always cite the URLs from web search when providing factual claims or pricing data.`;
  }

  /**
   * Builds the conversation contents array and injects retrieved past memories if relevant.
   */
  public buildContents(
    sessionId: string,
    currentUserInput: string,
    options: PromptContextOptions = {}
  ): { contents: ContentItem[]; retrievedContextCount: number } {
    const refDate = options.referenceDate || new Date();
    const historyLimit = options.historyLimit || 20;

    // 1. Fetch recent in-session history
    const recentMessages = this.store.getRecentMessages(sessionId, historyLimit);

    // 2. Temporal & keyword retrieval across memory
    const temporalRange = parseTemporalExpression(currentUserInput, refDate);
    let pastContextMatches: MessageRecord[] = [];

    if (temporalRange) {
      // Query messages that occurred in that specific time window
      pastContextMatches = this.store.queryMessages({
        startDate: temporalRange.startDate,
        endDate: temporalRange.endDate,
        limit: 10,
      });
    }

    // Also search by salient keywords if user input references specific topics
    const keywords = this.extractKeywords(currentUserInput);
    if (keywords.length > 0) {
      for (const kw of keywords) {
        const kwMatches = this.store.queryMessages({
          query: kw,
          limit: 5,
        });
        for (const m of kwMatches) {
          if (!pastContextMatches.some((existing) => existing.id === m.id)) {
            pastContextMatches.push(m);
          }
        }
      }
    }

    // Filter out messages that are already in the immediate recent session history to avoid duplicate tokens
    const recentIds = new Set(recentMessages.map((m) => m.id));
    const nonRedundantPast = pastContextMatches.filter((m) => !recentIds.has(m.id));

    // Format retrieved past context if any exists
    let contextHeader = "";
    if (nonRedundantPast.length > 0) {
      const pastSummary = nonRedundantPast
        .map((m) => `[Date: ${m.timestamp}] (${m.role.toUpperCase()}): ${m.content}`)
        .join("\n");
      contextHeader = `<retrieved_past_context>\nRelevant past conversations found in memory:\n${pastSummary}\n</retrieved_past_context>\n\n`;
    }

    // 3. Assemble Gemini ContentItems
    const contents: ContentItem[] = [];

    // Map recent messages
    for (const msg of recentMessages) {
      if (msg.role === "user") {
        contents.push({ role: "user", parts: [{ text: msg.content }] });
      } else if (msg.role === "assistant") {
        contents.push({ role: "model", parts: [{ text: msg.content }] });
      }
    }

    // Add current user input (with prepended past context if found)
    const finalUserText = contextHeader ? `${contextHeader}${currentUserInput}` : currentUserInput;
    contents.push({
      role: "user",
      parts: [{ text: finalUserText }],
    });

    return { contents, retrievedContextCount: nonRedundantPast.length };
  }

  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase().match(/\b[a-z0-9_-]{3,}\b/g) || [];
    const stopWords = new Set([
      "the", "and", "for", "with", "that", "this", "what", "did", "ask", "you",
      "have", "has", "any", "them", "about", "since", "then", "last", "were",
      "are", "your", "answer", "still", "correct", "today", "yesterday"
    ]);
    return words.filter((w) => !stopWords.has(w)).slice(0, 3);
  }
}
