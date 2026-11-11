import readline from "node:readline";
import { config } from "./config.js";
import { SqliteStore } from "./memory/sqlite_store.js";
import { SearchService } from "./tools/search_service.js";
import { GeminiClient } from "./llm/gemini_client.js";
import { AgentLoop } from "./agent/agent_loop.js";

async function main() {
  console.log("\n=======================================================");
  console.log("🤖 minimi Terminal Chat Agent (Interactive Mode)");
  console.log(`• Model: ${config.geminiModel}`);
  console.log(`• Search: ${config.tavilyApiKey ? "Tavily + DuckDuckGo" : "DuckDuckGo"}`);
  console.log(`• Type 'exit' or 'quit' to end session.`);
  console.log("=======================================================\n");

  const store = new SqliteStore(config.dbPath);
  const searchService = new SearchService(config.tavilyApiKey);
  const geminiClient = new GeminiClient(config.geminiApiKey, config.geminiModel);
  const agent = new AgentLoop(store, searchService, geminiClient);

  const sessionId = "cli-session-" + Date.now();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const promptUser = () => {
    rl.question("\nYou > ", async (input) => {
      const clean = input.trim();
      if (!clean) {
        promptUser();
        return;
      }

      if (clean.toLowerCase() === "exit" || clean.toLowerCase() === "quit") {
        console.log("Goodbye!");
        rl.close();
        process.exit(0);
      }

      console.log("\n[Thinking & Searching...]");

      try {
        const result = await agent.run(sessionId, clean, {
          onStep: (step) => {
            if (step.type === "tool_call") {
              console.log(`  🔍 [Tool Call] ${step.tool}("${step.query}")`);
            } else if (step.type === "tool_result") {
              console.log(`  ✓  [Tool Result] Found ${step.resultsCount} items via ${step.provider}`);
            }
          },
        });

        console.log(`\nAgent > ${result.reply}\n`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`\n[Agent Error]: ${msg}\n`);
      }

      promptUser();
    });
  };

  promptUser();
}

main().catch(console.error);
