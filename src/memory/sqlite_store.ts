import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";
import type { MessageRecord, SessionRecord, MemoryQuery } from "./types.js";

export class SqliteStore {
  private db: DatabaseType;

  constructor(dbPath: string = ":memory:") {
    this.db = new Database(dbPath);
    // Performance and resilience settings
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("synchronous = NORMAL");
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        created_at_epoch INTEGER NOT NULL,
        metadata TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
      CREATE INDEX IF NOT EXISTS idx_messages_epoch ON messages(created_at_epoch);
      CREATE INDEX IF NOT EXISTS idx_messages_role ON messages(role);
    `);
  }

  public createSession(id: string = crypto.randomUUID(), title: string = "New Chat"): SessionRecord {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, title, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at
    `);
    stmt.run(id, title, now, now);
    return { id, title, createdAt: now, updatedAt: now };
  }

  public getSession(id: string): SessionRecord | null {
    const stmt = this.db.prepare("SELECT id, title, created_at as createdAt, updated_at as updatedAt FROM sessions WHERE id = ?");
    const row = stmt.get(id) as SessionRecord | undefined;
    return row || null;
  }

  public listSessions(): SessionRecord[] {
    const stmt = this.db.prepare("SELECT id, title, created_at as createdAt, updated_at as updatedAt FROM sessions ORDER BY updated_at DESC");
    return stmt.all() as SessionRecord[];
  }

  public updateSessionTitle(sessionId: string, title: string): void {
    const stmt = this.db.prepare("UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?");
    stmt.run(title.trim(), new Date().toISOString(), sessionId);
  }

  public deleteSession(sessionId: string): void {
    this.db.prepare("DELETE FROM messages WHERE session_id = ?").run(sessionId);
    this.db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
  }

  public saveMessage(msg: Omit<MessageRecord, "id">): number {
    const now = msg.timestamp ? new Date(msg.timestamp) : new Date();
    const timestamp = now.toISOString();
    const epoch = msg.createdAtEpoch || now.getTime();

    // Ensure session exists
    this.createSession(msg.sessionId);

    const stmt = this.db.prepare(`
      INSERT INTO messages (session_id, role, content, timestamp, created_at_epoch, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      msg.sessionId,
      msg.role,
      msg.content,
      timestamp,
      epoch,
      msg.metadata || null
    );

    // Update session updatedAt
    this.db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(timestamp, msg.sessionId);

    return Number(result.lastInsertRowid);
  }

  public getRecentMessages(sessionId: string, limit: number = 30): MessageRecord[] {
    const stmt = this.db.prepare(`
      SELECT 
        id, 
        session_id as sessionId, 
        role, 
        content, 
        timestamp, 
        created_at_epoch as createdAtEpoch, 
        metadata
      FROM messages
      WHERE session_id = ?
      ORDER BY id ASC
      LIMIT ?
    `);
    return stmt.all(sessionId, limit) as MessageRecord[];
  }

  public queryMessages(options: MemoryQuery): MessageRecord[] {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (options.sessionId) {
      conditions.push("session_id = ?");
      params.push(options.sessionId);
    }

    if (options.startDate) {
      const startEpoch = new Date(options.startDate).getTime();
      if (!Number.isNaN(startEpoch)) {
        conditions.push("created_at_epoch >= ?");
        params.push(startEpoch);
      }
    }

    if (options.endDate) {
      const endEpoch = new Date(options.endDate).getTime();
      if (!Number.isNaN(endEpoch)) {
        conditions.push("created_at_epoch <= ?");
        params.push(endEpoch);
      }
    }

    if (options.query && options.query.trim()) {
      conditions.push("content LIKE ?");
      params.push(`%${options.query.trim()}%`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = options.limit && options.limit > 0 ? options.limit : 50;

    const querySql = `
      SELECT 
        id, 
        session_id as sessionId, 
        role, 
        content, 
        timestamp, 
        created_at_epoch as createdAtEpoch, 
        metadata
      FROM messages
      ${whereClause}
      ORDER BY created_at_epoch ASC
      LIMIT ?
    `;

    params.push(limit);

    const stmt = this.db.prepare(querySql);
    return stmt.all(...params) as MessageRecord[];
  }

  public clearAll(): void {
    this.db.exec("DELETE FROM messages; DELETE FROM sessions;");
  }

  public close(): void {
    this.db.close();
  }
}
