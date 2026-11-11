import type { SqliteStore } from "../memory/sqlite_store.js";
import type { SearchService } from "../tools/search_service.js";
import type { LLMClientInterface, ContentItem, FunctionCallItem } from "../llm/types.js";
import { PromptBuilder } from "./prompt_builder.js";

export interface AgentStep {
  type: "thinking" | "tool_call" | "tool_result" | "final_answer";
  tool?: string;
  query?: string;
  provider?: string;
  resultsCount?: number;
  content?: string;
}

export interface AgentRunOptions {
  referenceDate?: Date;
  maxIterations?: number;
  onStep?: (step: AgentStep) => void;
}

export interface AgentRunResult {
  reply: string;
  steps: AgentStep[];
  sessionId: string;
  iterations: number;
}

export class AgentLoop {
  private store: SqliteStore;
  private searchService: SearchService;
  private llm: LLMClientInterface;
  private promptBuilder: PromptBuilder;

  constructor(store: SqliteStore, searchService: SearchService, llm: LLMClientInterface) {
    this.store = store;
    this.searchService = searchService;
    this.llm = llm;
    this.promptBuilder = new PromptBuilder(store);
  }

  /**
   * Executes the ReAct conversation and tool execution loop.
   */
  public async run(
    sessionId: string,
    userInput: string,
    options: AgentRunOptions = {}
  ): Promise<AgentRunResult> {
    const maxIterations = options.maxIterations || 5;
    const refDate = options.referenceDate || new Date();
    const onStep = options.onStep || (() => {});
    const steps: AgentStep[] = [];

    // 1. Persist incoming user message to memory
    this.store.saveMessage({
      sessionId,
      role: "user",
      content: userInput,
      timestamp: refDate.toISOString(),
      createdAtEpoch: refDate.getTime(),
    });

    // 2. Build system instructions and initial context
    const systemInstruction = this.promptBuilder.buildSystemInstruction(refDate);
    const { contents } = this.promptBuilder.buildContents(sessionId, userInput, {
      referenceDate: refDate,
    });

    let iterations = 0;
    let finalAnswer = "";
    const collectedSearchResults: string[] = [];

    // 3. Execution loop with hard circuit-breaker
    while (iterations < maxIterations) {
      iterations++;

      const stepThinking: AgentStep = { type: "thinking" };
      steps.push(stepThinking);
      onStep(stepThinking);

      let llmRes;
      try {
        llmRes = await this.llm.generate(contents, systemInstruction);
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        finalAnswer = `[Error communicating with model: ${errMsg}]`;
        break;
      }

      // Handle Tool Calls (function calls)
      if (llmRes.functionCalls && llmRes.functionCalls.length > 0) {
        // Append model turn preserving exact raw modelParts (contains thoughtSignature and IDs)
        const modelPartsToAppend =
          llmRes.modelParts && llmRes.modelParts.length > 0
            ? llmRes.modelParts
            : llmRes.functionCalls.map((fc) => ({ functionCall: fc }));

        contents.push({
          role: "model",
          parts: modelPartsToAppend,
        });

        // Execute all function calls and gather their responses into a single user turn
        const userResponseParts: any[] = [];

        for (const fc of llmRes.functionCalls) {
          if (fc.name === "web_search") {
            const rawQuery = String(
              fc.args?.query ||
              (Array.isArray(fc.args?.queries) ? fc.args.queries[0] : "") ||
              userInput
            ).trim();

            const toolCallStep: AgentStep = {
              type: "tool_call",
              tool: "web_search",
              query: rawQuery,
            };
            steps.push(toolCallStep);
            onStep(toolCallStep);

            // Execute search
            const searchResponse = await this.searchService.search(rawQuery);
            const formattedResult = this.searchService.formatForLLM(searchResponse);
            collectedSearchResults.push(formattedResult);

            const toolResultStep: AgentStep = {
              type: "tool_result",
              tool: "web_search",
              provider: searchResponse.provider,
              resultsCount: searchResponse.results.length,
              content: formattedResult,
            };
            steps.push(toolResultStep);
            onStep(toolResultStep);

            const funcResponseObj: Record<string, any> = {
              name: "web_search",
              response: {
                output: formattedResult,
              },
            };
            if (fc.id) {
              funcResponseObj.id = fc.id;
            }

            userResponseParts.push({ functionResponse: funcResponseObj });
          } else {
            // Unknown tool fallback
            userResponseParts.push({
              functionResponse: {
                name: fc.name,
                ...(fc.id ? { id: fc.id } : {}),
                response: { error: `Tool ${fc.name} is not supported. Use web_search.` },
              },
            });
          }
        }

        // Append the user tool responses as a SINGLE turn matching the model's function calls
        contents.push({
          role: "user",
          parts: userResponseParts,
        });

        // Continue loop to allow model to synthesize search results
        continue;
      }

      // Model returned textual response without tool calls -> Final Answer
      if (llmRes.text) {
        finalAnswer = llmRes.text.trim();
        break;
      }

      // Safety fallback if neither text nor function call was returned
      finalAnswer = "I couldn't generate a response for this request.";
      break;
    }

    if (!finalAnswer) {
      // If loop finished after searching without textual answer, synthesize directly from all gathered search results
      if (collectedSearchResults.length > 0) {
        try {
          const synthesisPrompt = `User Question: "${userInput}"

Web Search Results:
${collectedSearchResults.join("\n\n---\n\n")}

Based on the web search results above, answer the user's question directly, accurately, and concisely. Cite the source URLs.`;

          const synthesisInstruction =
            "You are a helpful, fact-grounded assistant. Provide a direct, complete, and factual response to the user's question using the provided web search results. Cite all source URLs.";

          const synthesisRes = await this.llm.generate(
            [{ role: "user", parts: [{ text: synthesisPrompt }] }],
            synthesisInstruction,
            { disableTools: true }
          );

          if (synthesisRes.text && synthesisRes.text.trim()) {
            finalAnswer = synthesisRes.text.trim();
          }
        } catch (err: unknown) {
          console.warn("[AgentLoop] Synthesis fallback error:", err);
        }
      }

      if (!finalAnswer) {
        finalAnswer = "I completed several web searches but reached the maximum allowed tool iterations. Please refine your query.";
      }
    }

    // 4. Persist assistant final reply to memory
    this.store.saveMessage({
      sessionId,
      role: "assistant",
      content: finalAnswer,
      timestamp: new Date().toISOString(),
      createdAtEpoch: Date.now(),
    });

    const finalStep: AgentStep = {
      type: "final_answer",
      content: finalAnswer,
    };
    steps.push(finalStep);
    onStep(finalStep);

    return {
      reply: finalAnswer,
      steps,
      sessionId,
      iterations,
    };
  }
}
