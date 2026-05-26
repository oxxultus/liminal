// src/main/db.ts
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import { app } from 'electron';

const dbPath = path.join(app.getPath('userData'), 'database.db');

export async function initDb() {
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS engines (
      id TEXT PRIMARY KEY,
      name TEXT,
      provider TEXT,
      url TEXT,
      model TEXT,
      apiKey TEXT
    );

    -- 채팅 세션 테이블
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      title TEXT,
      engineId TEXT,
      updatedAt INTEGER
    );

    -- 메시지 테이블
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      sessionId TEXT,
      role TEXT,
      content TEXT,
      timestamp INTEGER,
      FOREIGN KEY(sessionId) REFERENCES chat_sessions(id) ON DELETE CASCADE
    );

    -- 플러그인 설정 테이블
    CREATE TABLE IF NOT EXISTS mcp_plugins (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,          -- 'remote' | 'local'
      name TEXT NOT NULL,
      url TEXT,
      apiKey TEXT,
      workspaceDir TEXT,
      enabled INTEGER NOT NULL DEFAULT 1  -- SQLite에는 BOOLEAN 없음, 1/0 사용
    );

    -- 세션별 요약본 테이블
    CREATE TABLE IF NOT EXISTS session_summaries (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      summary TEXT NOT NULL,         -- 요약 내용
      coveredUpTo INTEGER NOT NULL,  -- 요약이 어디까지 커버하는지 (message timestamp)
      createdAt INTEGER NOT NULL,
      FOREIGN KEY(sessionId) REFERENCES chat_sessions(id) ON DELETE CASCADE
    );
  `);
  return db;
}