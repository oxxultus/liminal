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

  // 💡 [무결성 보장] SQLite 외래키 연동 규격 강제 활성화 (세션 삭제 시 하위 메시지/요약 자동 CASCADE 청소)
  await db.get('PRAGMA foreign_keys = ON');

  await db.exec(`
    -- 1. 코어 LLM 엔진 설정 테이블
    CREATE TABLE IF NOT EXISTS engines (
      id TEXT PRIMARY KEY,
      name TEXT,
      provider TEXT,
      url TEXT,
      model TEXT,
      apiKey TEXT
    );

    -- 2. 채팅 세션 테이블
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      title TEXT,
      engineId TEXT,
      updatedAt INTEGER
    );

    -- 3. 메시지 테이블
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      sessionId TEXT,
      role TEXT,
      content TEXT,
      timestamp INTEGER,
      FOREIGN KEY(sessionId) REFERENCES chat_sessions(id) ON DELETE CASCADE
    );

    -- 4. 플러그인 설정 테이블 (구조 간소화 및 역할 명확화)
    CREATE TABLE IF NOT EXISTS mcp_plugins (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT,
      apiKey TEXT,
      workspaceDir TEXT,
      keywords TEXT,                      -- 💡 [신규 추가] 콤마로 구분된 키워드 저장소 (예: "파일,메모,로그")
      enabled INTEGER NOT NULL DEFAULT 1
    );

    -- 5. 세션별 요약본 테이블 (UPSERT 붕괴 방지 패치)
    CREATE TABLE IF NOT EXISTS session_summaries (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL UNIQUE,  -- 💡 ON CONFLICT(sessionId)의 안정적 구동을 위해 UNIQUE 명시
      summary TEXT NOT NULL,
      coveredUpTo INTEGER NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY(sessionId) REFERENCES chat_sessions(id) ON DELETE CASCADE
    );

    -- ⚡ [성능 최적화] 대량 데이터 조회 성능 방어를 위한 인덱스 생성
    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(sessionId);
    CREATE INDEX IF NOT EXISTS idx_summaries_session ON session_summaries(sessionId);
  `);
  
  return db;
}