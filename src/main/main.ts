// src/main/main.ts
import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs'; 
import { McpPluginManager } from './mcp/pluginManager';
import { initDb } from './db'; // 비동기 초기화 함수로 변경

let mainWindow: BrowserWindow | null = null;
let db: any; // DB 객체
let pluginManager: McpPluginManager;

const isDev = process.env.NODE_ENV === 'development';
const ENG_PATH = isDev 
  ? path.join(app.getPath('temp'), 'engines.json') 
  : path.join(app.getPath('userData'), 'engines.json');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800, frame: false, titleBarStyle: 'hiddenInset', 
    transparent: true, hasShadow: true, 
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  if (isDev) mainWindow.loadURL('http://localhost:5173');
  else mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

function registerIpcHandlers() {
  ipcMain.handle('mcp:get-tools', async () => await pluginManager.getAllToolsForLlm());
  ipcMain.handle('get-mcp-plugins-list', async () => await pluginManager.getPluginsConfigList());
  ipcMain.handle('remove-mcp-plugin', async (_, pluginId: string) => {
    try { await pluginManager.removePlugin(pluginId); return { success: true }; }
    catch (error: any) { return { success: false, error: error.message }; }
  });
  ipcMain.handle('mcp:add-plugin', async (_event, config) => {
    try { const tools = await pluginManager.registerNewPlugin(config); return { success: true, tools }; }
    catch (error: any) { return { success: false, error: error.message }; }
  });
  ipcMain.handle('mcp:execute-tool', async (_event, { toolName, args }) => {
    try { const result = await pluginManager.routeCallTool(toolName, args); return { success: true, result }; }
    catch (error: any) { return { success: false, error: error.message }; }
  });

  // 1. 엔진 리스트 가져오기 (비동기 DB)
  ipcMain.handle('llm:get-engines', async () => await db.all('SELECT * FROM engines'));

  // 2. 엔진 추가
  ipcMain.handle('llm:add-engine', async (_, engine) => {
    try {
      await db.run(
        'INSERT INTO engines (id, name, provider, url, model, apiKey) VALUES (?, ?, ?, ?, ?, ?)',
        [engine.id, engine.name, engine.provider, engine.url, engine.model, engine.apiKey]
      );
      return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
  });

  // 3. 엔진 삭제
  ipcMain.handle('llm:remove-engine', async (_, id) => {
    try { await db.run('DELETE FROM engines WHERE id = ?', [id]); return { success: true }; }
    catch (e: any) { return { success: false, error: e.message }; }
  });

  // 4. 통합 프록시 라우터
  ipcMain.handle('llm:chat-proxy', async (_, { engine, messages, apiKey, tools }) => {
    try {
      let headers: any = { 'Content-Type': 'application/json' };
      let body: any = { model: engine.model };
      let url = engine.url;

      if (engine.provider === 'anthropic') {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        body.messages = messages;
        body.max_tokens = 1024;
        if (tools && tools.length > 0) body.tools = tools;

      } else if (engine.provider === 'openai') {
        headers['Authorization'] = `Bearer ${apiKey}`;
        body.messages = messages;
        if (tools && tools.length > 0) body.tools = tools;

      } else if (engine.provider === 'google') {
        url = `${engine.url}?key=${apiKey}`;
        body.contents = messages.map((m: any) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: Array.isArray(m.content)
            ? m.content  // tool_result 배열 그대로
            : [{ text: m.content }],
        }));
        if (tools && tools.length > 0) body.tools = tools;
      }

      const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      const rawData = await response.json();
      if (!response.ok) throw new Error(JSON.stringify(rawData));

      // provider별 응답 파싱 - rawContent/rawMessage를 함께 반환해 프론트가 도구 호출 여부를 판단
      if (engine.provider === 'anthropic') {
        const textBlock = rawData.content?.find((b: any) => b.type === 'text');
        return {
          success: true,
          data: {
            text: textBlock?.text ?? '',
            rawContent: rawData.content, // tool_use 블록 포함한 원본 배열
          },
        };

      } else if (engine.provider === 'openai') {
        const message = rawData.choices[0].message;
        return {
          success: true,
          data: {
            text: message.content ?? '',
            rawMessage: message, // tool_calls 포함한 원본 메시지
          },
        };

      } else if (engine.provider === 'google') {
        const text = rawData.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        return { success: true, data: { text } };
      }

      return { success: false, error: '지원하지 않는 provider' };

    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // --- 세션 관련 ---
  ipcMain.handle('chat:get-sessions', async () => {
    return await db.all('SELECT * FROM chat_sessions ORDER BY updatedAt DESC');
  });

  ipcMain.handle('chat:create-session', async (_, { id, title, engineId }) => {
    await db.run(
      'INSERT INTO chat_sessions (id, title, engineId, updatedAt) VALUES (?, ?, ?, ?)',
      [id, title, engineId, Date.now()]
    );
    return { success: true };
  });

  ipcMain.handle('chat:delete-session', async (_, sessionId) => {
    await db.run('DELETE FROM chat_sessions WHERE id = ?', [sessionId]);
    return { success: true };
  });

  // --- 메시지 관련 ---
  ipcMain.handle('chat:get-messages', async (_, sessionId) => {
    return await db.all('SELECT * FROM messages WHERE sessionId = ? ORDER BY timestamp ASC', [sessionId]);
  });

  ipcMain.handle('chat:save-message', async (_, { id, sessionId, role, content }) => {
    await db.run(
      'INSERT INTO messages (id, sessionId, role, content, timestamp) VALUES (?, ?, ?, ?, ?)',
      [id, sessionId, role, content, Date.now()]
    );
    // 세션의 업데이트 시간 갱신
    await db.run('UPDATE chat_sessions SET updatedAt = ? WHERE id = ?', [Date.now(), sessionId]);
    return { success: true };
  });

  ipcMain.handle('chat:update-session-title', async (_, { sessionId, title }) => {
    await db.run('UPDATE chat_sessions SET title = ?, updatedAt = ? WHERE id = ?', [title, Date.now(), sessionId]);
    return { success: true };
  });

  // 세션 요약 조회
  ipcMain.handle('summary:get', async (_, sessionId: string) => {
    try {
      const row = await db.get(
        'SELECT * FROM session_summaries WHERE sessionId = ?',
        [sessionId]
      );
      return row ?? null;
    } catch (e: any) {
      return null;
    }
  });
  
  // 세션 요약 저장 (UPSERT - sessionId 당 1개 유지)
  ipcMain.handle('summary:save', async (_, { id, sessionId, summary, coveredUpTo }) => {
    try {
      await db.run(
        `INSERT INTO session_summaries (id, sessionId, summary, coveredUpTo, createdAt)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(sessionId) DO UPDATE SET
          summary = excluded.summary,
          coveredUpTo = excluded.coveredUpTo,
          createdAt = excluded.createdAt`,
        [id, sessionId, summary, coveredUpTo, Date.now()]
      );
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

}

const migrateEngines = async () => {
  const count = await db.get('SELECT count(*) as count FROM engines');
  if (count.count === 0 && fs.existsSync(ENG_PATH)) {
    try {
      const oldData = JSON.parse(fs.readFileSync(ENG_PATH, 'utf-8'));
      for (const eng of oldData) {
        await db.run('INSERT INTO engines (id, name, provider, url, model, apiKey) VALUES (?, ?, ?, ?, ?, ?)',
          [eng.id, eng.name, eng.provider, eng.url, eng.model, eng.apiKey]);
      }
      fs.renameSync(ENG_PATH, ENG_PATH + '.bak');
      console.log('✅ SQLite 마이그레이션 완료');
    } catch (e) { console.error('❌ 마이그레이션 실패:', e); }
  }
};

app.whenReady().then(async () => {
  db = await initDb(); // DB 초기화
  await migrateEngines();
  pluginManager = new McpPluginManager(db);
  await pluginManager.loadPlugins();
  registerIpcHandlers();
  createWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });