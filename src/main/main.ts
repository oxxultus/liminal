// src/main/main.ts
import { app, BrowserWindow, ipcMain, dialog } from 'electron'; 
import * as path from 'path';
import axios from 'axios';
import * as fs from 'fs';                  
import * as fsPromises from 'fs/promises'; 
import { McpPluginManager } from './mcp/pluginManager';
import { initDb } from './db';

let mainWindow: BrowserWindow | null = null;
let db: any; 
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
  ipcMain.handle('mcp:get-tools', async () => await pluginManager.getAllToolsForLlm(''));
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
    try { 
      const result = await pluginManager.routeCallTool(toolName, args, mainWindow!); 
      return { success: true, result }; 
    }
    catch (error: any) { return { success: false, error: error.message }; }
  });

  ipcMain.handle('llm:get-engines', async () => await db.all('SELECT * FROM engines'));

  ipcMain.handle('llm:add-engine', async (_, engine) => {
    try {
      await db.run(
        'INSERT INTO engines (id, name, provider, url, model, apiKey) VALUES (?, ?, ?, ?, ?, ?)',
        [engine.id, engine.name, engine.provider, engine.url, engine.model, engine.apiKey]
      );
      return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('llm:remove-engine', async (_, id) => {
    try { await db.run('DELETE FROM engines WHERE id = ?', [id]); return { success: true }; }
    catch (e: any) { return { success: false, error: e.message }; }
  });

  // =========================================================================
  // 💡 [핵심 리팩토링] 연쇄적 도구 호출(Multi-Tool Calling) 지원 무한 루프 프록시 엔진
  // =========================================================================
  ipcMain.handle('llm:chat-proxy', async (_, { engine, messages, apiKey, tools: staticTools }) => {
  try {
    let currentMessages = [...messages];
    let headers: any = { 'Content-Type': 'application/json' };
    let url = engine.url;

    if (engine.provider === 'openai') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else if (engine.provider === 'anthropic') {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
    } else if (engine.provider === 'google') {
      url = `${engine.url}?key=${apiKey}`;
    }

    // 오케스트레이션 무한 루프 가동
    while (true) {
      let body: any = { model: engine.model };

      // 동적 문맥 필터링 툴셋 추출
      const lastMessage = currentMessages[currentMessages.length - 1];
      let textPrompt = '';
      if (lastMessage && lastMessage.content) {
        textPrompt = Array.isArray(lastMessage.content)
          ? lastMessage.content.map((c: any) => c.text || '').join(' ')
          : String(lastMessage.content);
      }
      const dynamicTools = await pluginManager.getAllToolsForLlm(textPrompt);

      // 프로바이더별 바디 조립
      if (engine.provider === 'openai') {
        body.messages = currentMessages;
        if (dynamicTools && dynamicTools.length > 0) body.tools = dynamicTools;
      } else if (engine.provider === 'anthropic') {
        body.messages = currentMessages;
        body.max_tokens = 2048; // 대량 텍스트 분석을 위해 마진 확대
        if (dynamicTools && dynamicTools.length > 0) {
          body.tools = dynamicTools.map((t: any) => ({
            name: t.name,
            description: t.description,
            input_schema: t.input_schema
          }));
        }
      } else if (engine.provider === 'google') {
        body.contents = currentMessages.map((m: any) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: Array.isArray(m.content) ? m.content : [{ text: String(m.content) }],
        }));
      }

      // HTTP 통신 실행
      const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
      const rawData = await response.json();
      if (!response.ok) throw new Error(JSON.stringify(rawData));

      // ---------------------------------------------------------------------
      // 분기 1. OpenAI 프로바이더 제어 루프
      // ---------------------------------------------------------------------
      if (engine.provider === 'openai') {
        const assistantMessage = rawData.choices[0].message;

        if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
          return { success: true, data: { text: assistantMessage.content || '', rawMessage: assistantMessage } };
        }

        currentMessages.push(assistantMessage);

        for (const toolCall of assistantMessage.tool_calls) {
          const toolName = toolCall.function.name;
          const toolArgs = JSON.parse(toolCall.function.arguments);

          console.log(`⚙️ [MCP 루프] OpenAI 도구 가동: ${toolName}`);
          const toolResult = await pluginManager.routeCallTool(toolName, toolArgs, mainWindow!);

          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            name: toolName,
            content: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult)
          });
        }
        continue; 
      }

      // ---------------------------------------------------------------------
      // 분기 2. Anthropic Claude 프로바이더 제어 루프 (버그 수정 완비)
      // ---------------------------------------------------------------------
      if (engine.provider === 'anthropic') {
        // 도구 사용 플래그 분석
        const isToolUse = rawData.stop_reason === 'tool_use' || rawData.content?.some((b: any) => b.type === 'tool_use');

        // 💡 [최종 텍스트 완료 분기] 더 이상 도구 호출이 없다면 렌더러 호환 규격으로 포매팅하여 즉시 탈출!
        if (!isToolUse) {
          const textBlock = rawData.content?.find((b: any) => b.type === 'text');
          const finalReplyText = textBlock?.text ?? '';
          
          return { 
            success: true, 
            data: { 
              text: finalReplyText, 
              // 프론트엔드가 OpenAI 규격의 .content 를 안전하게 파싱할 수 있도록 가상 메타 매핑 제공
              rawMessage: { role: 'assistant', content: finalReplyText } 
            } 
          };
        }

        // 도구 실행 단계 진입: 클로드의 의사를 히스토리에 먼저 주입
        currentMessages.push({ role: 'assistant', content: rawData.content });

        const toolRequests = rawData.content.filter((b: any) => b.type === 'tool_use');
        const toolResultsBlocks: any[] = [];

        for (const req of toolRequests) {
          console.log(`⚙️ [MCP 루프] Claude 도구 가동: ${req.name}`);
          const toolResult = await pluginManager.routeCallTool(req.name, req.input, mainWindow!);

          // 툴 응답 결과물 텍스트 가공 처리
          let resultText = '';
          if (toolResult && toolResult.content && toolResult.content[0]) {
            resultText = toolResult.content[0].text || JSON.stringify(toolResult);
          } else {
            resultText = JSON.stringify(toolResult);
          }

          toolResultsBlocks.push({
            type: 'tool_result',
            tool_use_id: req.id,
            content: resultText
          });
        }

        // 대화 히스토리에 툴 실행 결과 보고서 합체 후 루프 리로드
        currentMessages.push({ role: 'user', content: toolResultsBlocks });
        continue; 
      }

      // ---------------------------------------------------------------------
      // 분기 3. Google Gemini 프로바이더 처리
      // ---------------------------------------------------------------------
      if (engine.provider === 'google') {
        const text = rawData.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        return { success: true, data: { text, rawMessage: { role: 'assistant', content: text } } };
      }

      break;
    }

    return { success: false, error: '지원하지 않는 provider 구조체 체인 오류' };
  } catch (error: any) {
    console.error("🚨 Proxy Error:", error);
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
    await db.run('UPDATE chat_sessions SET updatedAt = ? WHERE id = ?', [Date.now(), sessionId]);
    return { success: true };
  });

  ipcMain.handle('chat:update-session-title', async (_, { sessionId, title }) => {
    await db.run('UPDATE chat_sessions SET title = ?, updatedAt = ? WHERE id = ?', [title, Date.now(), sessionId]);
    return { success: true };
  });

  ipcMain.handle('summary:get', async (_, sessionId: string) => {
    try {
      const row = await db.get('SELECT * FROM session_summaries WHERE sessionId = ?', [sessionId]);
      return row ?? null;
    } catch (e: any) { return null; }
  });
  
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
    } catch (e: any) { return { success: false, error: e.message }; }
  });

  ipcMain.handle('mcp:download-plugin', async (_, { downloadUrl, aliasName, workspaceDir, keywords }) => {
    try {
      const pluginsDir = path.join(app.getPath('userData'), 'external_plugins');
      await fsPromises.mkdir(pluginsDir, { recursive: true });

      const response = await axios.get(downloadUrl, { responseType: 'text' });
      const pluginCode = response.data;

      const pluginId = `custom-${Date.now()}`;
      const filename = `${pluginId}.js`;
      const targetFilePath = path.join(pluginsDir, filename);
      await fsPromises.writeFile(targetFilePath, pluginCode, 'utf-8');

      const keywordsStr = Array.isArray(keywords) ? keywords.join(',') : '';

      await db.run(
        `INSERT INTO mcp_plugins (id, type, name, url, apiKey, workspaceDir, keywords, enabled) 
        VALUES (?, 'custom', ?, ?, NULL, ?, ?, 1)`,
        [pluginId, aliasName, targetFilePath, workspaceDir, keywordsStr]
      );

      await pluginManager.registerNewPlugin({
        id: pluginId,
        type: 'custom', 
        name: aliasName,
        url: targetFilePath,
        workspaceDir: workspaceDir,
        keywords: keywords,
        enabled: true
      } as any);

      return { success: true, message: '플러그인 설치 및 워킹 디렉토리 매핑 완료' };
    } catch (error: any) { return { success: false, error: error.message }; }
  });
  
  ipcMain.handle('mcp:open-file-dialog', async () => {
    if (!mainWindow) return { canceled: true, filePaths: [] };
    return await dialog.showOpenDialog(mainWindow, {
      title: 'MCP 플러그인 JavaScript 스크립트 파일 선택',
      filters: [{ name: 'JavaScript Files', extensions: ['mjs'] }],
      properties: ['openFile']
    });
  });

  ipcMain.handle('mcp:upload-plugin', async (_, { sourceFilePath, aliasName, keywords }) => {
    try {
      const pluginsDir = path.join(app.getPath('userData'), 'external_plugins');
      await fsPromises.mkdir(pluginsDir, { recursive: true });

      const pluginId = `custom-${Date.now()}`;
      const filename = `${pluginId}.js`;
      const targetFilePath = path.join(pluginsDir, filename);
      
      await fsPromises.copyFile(sourceFilePath, targetFilePath);

      const keywordsStr = Array.isArray(keywords) ? keywords.join(',') : '';

      await db.run(
        `INSERT INTO mcp_plugins (id, type, name, url, workspaceDir, keywords, enabled) 
         VALUES (?, 'custom', ?, ?, NULL, ?, 1)`,
         [pluginId, aliasName, targetFilePath, keywordsStr]
      );

      await pluginManager.registerNewPlugin({
        id: pluginId,
        type: 'custom',
        name: aliasName,
        url: targetFilePath,
        keywords: keywords,
        enabled: true
      } as any);

      return { success: true, message: '로컬 플러그인 업로드 및 마운트 완료' };
    } catch (error: any) { return { success: false, error: error.message }; }
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
  db = await initDb(); 
  await migrateEngines();
  pluginManager = new McpPluginManager(db);
  await pluginManager.loadPlugins();
  registerIpcHandlers();
  createWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });