import type { ContentItem, LLMClientInterface, LLMResponse, FunctionCallItem, LLMGenerateOptions } from "./types.js";

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
  private apiKey: string;
  private model: string;
  private maxRetries: number;

  constructor(apiKey: string, model: string = "gemini-2.5-flash", maxRetries: number = 2) {
    this.apiKey = apiKey?.trim() || "";
    this.model = model?.trim() || "gemini-2.5-flash";
    this.maxRetries = maxRetries;
  }

  public setApiKey(key: string): void {
    this.apiKey = key.trim();
  }

  public async generate(
    contents: ContentItem[],
    systemInstruction?: string,
    options?: LLMGenerateOptions
  ): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not configured. Please add your GEMINI_API_KEY in .env or set it in your environment."
      );
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${encodeURIComponent(
      this.apiKey
    )}`;

    const requestBody: Record<string, any> = {
      contents,
      generationConfig: {
        temperature: 0.2,
      },
    };

    if (!options?.disableTools) {
      requestBody.tools = [WEB_SEARCH_TOOL_DECLARATION];
    }

    if (systemInstruction) {
      requestBody.systemInstruction = {
        role: "system",
        parts: [{ text: systemInstruction }],
      };
    }

    let attempt = 0;
    let lastError: unknown;

    while (attempt <= this.maxRetries) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errData = (await response.json().catch(() => ({}))) as any;
          const errMsg = errData.error?.message || `HTTP ${response.status} ${response.statusText}`;
          const errStatus = response.status;

          // Retry on 429 (rate limit) or 503 (service overloaded)
          if ((errStatus === 429 || errStatus === 503) && attempt < this.maxRetries) {
            attempt++;
            const backoffMs = attempt * 1500;
            console.warn(`[GeminiClient] Status ${errStatus}. Retrying in ${backoffMs}ms (attempt ${attempt}/${this.maxRetries})...`);
            await new Promise((r) => setTimeout(r, backoffMs));
            continue;
          }

          throw new Error(`Gemini API Error (${errStatus}): ${errMsg}`);
        }

        const data = (await response.json()) as any;
        const candidate = data.candidates?.[0];
        const parts = candidate?.content?.parts || [];

        let text: string | undefined;
        const functionCalls: FunctionCallItem[] = [];

        for (const part of parts) {
          if (part.text) {
            text = (text ? text + "\n" : "") + part.text;
          }
          if (part.functionCall) {
            functionCalls.push({
              name: part.functionCall.name,
              args: part.functionCall.args || {},
              id: part.functionCall.id,
              thoughtSignature: part.thoughtSignature,
            });
          }
        }

        return {
          text,
          functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
          modelParts: parts,
          usage: {
            promptTokens: data.usageMetadata?.promptTokenCount,
            completionTokens: data.usageMetadata?.candidatesTokenCount,
            totalTokens: data.usageMetadata?.totalTokenCount,
          },
        };
      } catch (err: unknown) {
        lastError = err;
        attempt++;
        if (attempt <= this.maxRetries) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        break;
      }
    }

    throw lastError;
  }
}
