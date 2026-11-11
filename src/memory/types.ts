export type Role = "user" | "assistant" | "system" | "tool";

export interface MessageRecord {
  id?: number;
  sessionId: string;
  role: Role;
  content: string;
  timestamp: string; // ISO 8601
  createdAtEpoch: number; // Unix timestamp in ms
  metadata?: string; // JSON string for tool calls or extra data
}

export interface SessionRecord {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryQuery {
  sessionId?: string;
  query?: string;
  startDate?: string; // ISO 8601 or YYYY-MM-DD
  endDate?: string;   // ISO 8601 or YYYY-MM-DD
  limit?: number;
}
