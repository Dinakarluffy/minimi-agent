import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";

// Load .env if present
dotenv.config();

export interface AppConfig {
  geminiApiKey: string;
  geminiModel: string;
  tavilyApiKey?: string;
  port: number;
  dbPath: string;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const geminiApiKey = env.GEMINI_API_KEY?.trim() || "";
  const geminiModel = env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const tavilyApiKey = env.TAVILY_API_KEY?.trim() || undefined;
  
  const parsedPort = Number.parseInt(env.PORT || "3000", 10);
  const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3000;
  
  const dbPath = env.DB_PATH?.trim() || "data/agent.db";

  // Ensure database directory exists if relative
  const dbDir = path.dirname(dbPath);
  if (dbDir && !fs.existsSync(dbDir)) {
    try {
      fs.mkdirSync(dbDir, { recursive: true });
    } catch {
      // Ignore directory creation errors if already handled or in-memory
    }
  }

  return {
    geminiApiKey,
    geminiModel,
    tavilyApiKey,
    port,
    dbPath,
  };
}

export const config = loadConfig();
