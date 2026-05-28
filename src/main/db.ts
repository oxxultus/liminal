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

    -- 3. messages 테이블
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      sessionId TEXT,
      role TEXT,
      content TEXT,
      timestamp INTEGER,
      FOREIGN KEY(sessionId) REFERENCES chat_sessions(id) ON DELETE CASCADE
    );

    -- 4. 플러그인 설정 테이블 (통합 및 스펙 일원화 패치 완료)
    CREATE TABLE IF NOT EXISTS mcp_plugins (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT,
      apiKey TEXT,
      workspaceDir TEXT,
      keywords TEXT,
      version TEXT DEFAULT '1.0.0',       -- 💡 하단 메서드를 없애고 여기에 완전히 통일 및 정착
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

    -- 6. 시퀀스 마스터 테이블 (워크플로우의 이름과 순서 정의)
    CREATE TABLE IF NOT EXISTS automation_sequences (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      isEnabled INTEGER NOT NULL DEFAULT 1, 
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL 
    );

    -- 7. 시퀀스 상세 스텝 테이블 (각 시퀀스가 실행할 도구들과 인자 맵)
    CREATE TABLE IF NOT EXISTS sequence_steps (
      id TEXT PRIMARY KEY,
      sequenceId TEXT NOT NULL,
      stepOrder INTEGER NOT NULL,
      fullToolName TEXT NOT NULL,
      argsTemplate TEXT NOT NULL,
      
      -- 💡 [안전 스냅샷 필드 추가]
      pluginId TEXT NOT NULL,         -- 대상 플러그인 고유 ID
      pluginType TEXT NOT NULL,       -- 'custom' (Stdio) 또는 'remote'
      pluginUrl TEXT,                 -- 스크립트 실물 경로 또는 원격 엔드포인트 URL
      pluginApiKey TEXT,              -- 원격 연동용 API Key
      pluginWorkspaceDir TEXT,        -- Stdio 실행용 작업 디렉토리
      
      FOREIGN KEY(sequenceId) REFERENCES automation_sequences(id) ON DELETE CASCADE
    );

    -- 8. 크론 스케줄 관리 테이블 (타임 트리거 연동)
    CREATE TABLE IF NOT EXISTS automation_schedules (
      id TEXT PRIMARY KEY,
      sequenceId TEXT NOT NULL UNIQUE,
      cronExpression TEXT NOT NULL,        -- 예: '0 3 * * *' (매일 새벽 3시)
      isEnabled INTEGER NOT NULL DEFAULT 1,
      lastRunTimestamp INTEGER,
      FOREIGN KEY(sequenceId) REFERENCES automation_sequences(id) ON DELETE CASCADE
    );

    -- ⚡ [성능 최적화] 대량 데이터 조회 성능 방어를 위한 인덱스 생성
    CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(sessionId);
    CREATE INDEX IF NOT EXISTS idx_summaries_session ON session_summaries(sessionId);
  `);

  console.log("💾 [DB Engine] SQLite 스키마 최적화 동기화 완료");
  
  return db;
}