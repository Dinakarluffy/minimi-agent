import { GoogleGenAI } from "@google/genai";
import type { ContentItem, LLMClientInterface, LLMResponse, FunctionCallItem } from "./types.js";

export const WEB_SEARCH_TOOL_DECLARATION = {
  functionDeclarations: [
    {
      name: "web_search",
      description: "Search the web for real-time information, pricing, news, and facts. Always use this tool when answering questions about current prices, recent events, or verifying facts.",
      parameters: {
        type: "OBJECT",
        properties: {
          query: {
            type: "STRING",
            description: "The targeted, concise search query to look up on the web.",
          },
        },
        required: ["query"],
      },
    },
  ],
};

export class GeminiClient implements LLMClientInterface {
  private ai?: GoogleGenAI;
  private apiKey: string;
  private model: string;
  private maxRetries: number;

  constructor(apiKey: string, model: string = "gemini-2.5-flash", maxRetries: number = 2) {
    this.apiKey = apiKey?.trim() || "";
    this.model = model?.trim() || "gemini-2.5-flash";
    this.maxRetries = maxRetries;

    if (this.apiKey) {
      this.ai = new GoogleGenAI({ apiKey: this.apiKey });
    }
  }

  public setApiKey(key: string): void {
    this.apiKey = key.trim();
    if (this.apiKey) {
      this.ai = new GoogleGenAI({ apiKey: this.apiKey });
    }
  }

  public async generate(contents: ContentItem[], systemInstruction?: string): Promise<LLMResponse> {
    if (!this.apiKey || !this.ai) {
      throw new Error(
        "GEMINI_API_KEY is not configured. Please add your GEMINI_API_KEY in .env or set it in your environment."
      );
    }

    let attempt = 0;
    let lastError: unknown;

    while (attempt <= this.maxRetries) {
      try {
        const response = await this.ai.models.generateContent({
          model: this.model,
          contents: contents as any,
          config: {
            systemInstruction: systemInstruction || undefined,
            tools: [WEB_SEARCH_TOOL_DECLARATION as any],
            temperature: 0.2, // Low temperature for factual precision and reliable tool calling
          },
        });

        const text = response.text || undefined;
        let functionCalls: FunctionCallItem[] | undefined;

        if (response.functionCalls && Array.isArray(response.functionCalls) && response.functionCalls.length > 0) {
          functionCalls = response.functionCalls.map((fc: any) => ({
            name: fc.name,
            args: fc.args || {},
          }));
        }

        return {
          text,
          functionCalls,
          usage: {
            promptTokens: response.usageMetadata?.promptTokenCount,
            completionTokens: response.usageMetadata?.candidatesTokenCount,
            totalTokens: response.usageMetadata?.totalTokenCount,
          },
        };
      } catch (err: any) {
        lastError = err;
        attempt++;

        // Retry on 429 (rate limit) or 503 (service overloaded)
        const status = err?.status || err?.code || 0;
        const msg = String(err?.message || "");
        const isRateLimitOrOverload = status === 429 || status === 503 || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED");

        if (isRateLimitOrOverload && attempt <= this.maxRetries) {
          const backoffMs = attempt * 1500;
          console.warn(`[GeminiClient] Rate limited / overloaded. Retrying in ${backoffMs}ms (attempt ${attempt}/${this.maxRetries})...`);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        break;
      }
    }

    throw lastError;
  }
}
