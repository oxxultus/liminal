// src/main/main.ts
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import axios from 'axios';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import { McpPluginManager } from './mcp/pluginManager';
import { initDb } from './db';

const execAsync = promisify(exec);

let mainWindow: BrowserWindow | null = null;
let db: any;
let pluginManager: McpPluginManager;

// =========================================================================
// 💡 [Health Cache] 전역에서 관리할 리모트 플러그인 생사 상태 메모리 풀
// =========================================================================
export const globalOnlineStates: Record<string, boolean> = {};

const isDev = process.env.NODE_ENV === 'development';
const ENG_PATH = isDev
  ? path.join(app.getPath('temp'), 'engines.json')
  : path.join(app.getPath('userData'), 'engines.json');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    titleBarStyle: 'hiddenInset',
    transparent: true,
    hasShadow: true,

    icon: process.platform === 'win32'
      ? path.join(__dirname, '../../assets/icons/icon.ico')
      : path.join(__dirname, '../../assets/icons/icon.png'),

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) mainWindow.loadURL('http://localhost:5173');
  else mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

// 💡 [전략 2] 외부 플러그인 전용 독립 의존성 환경 선제 구축
async function prepareExternalPluginsEnv() {
  const pluginsDir = path.join(app.getPath('userData'), 'external_plugins');
  const pkgPath = path.join(pluginsDir, 'package.json');

  try {
    if (!fs.existsSync(pluginsDir)) {
      await fsPromises.mkdir(pluginsDir, { recursive: true });
    }

    if (!fs.existsSync(pkgPath)) {
      const defaultPkg = {
        name: 'liminal-external-plugins',
        version: '1.0.0',
        type: 'module',
        dependencies: {
          '@modelcontextprotocol/sdk': '^1.0.1'
        }
      };
      await fsPromises.writeFile(pkgPath, JSON.stringify(defaultPkg, null, 2), 'utf-8');
      console.log('📦 외부 플러그인 격리용 package.json 생성 완료');
    }

    const nodeModulesPath = path.join(pluginsDir, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      console.log('⚙️ 외부 플러그인 전용 의존성 라이브러리 설치 중 (npm install)...');
      
      execAsync('npm install', { cwd: pluginsDir })
        .then(() => console.log('✅ 외부 플러그인 독립 node_modules 설치 완료'))
        .catch((err) => console.error('❌ 외부 플러그인 의존성 구성 실패:', err));
    }
  } catch (error) {
    console.error('❌ 외부 플러그인 인프라 세팅 중 예외 발생:', error);
  }
}

// =========================================================================
// 💡 [Health Cache Scheduler] 60초 주기로 무선 연동 단추 생사 정보 캐싱 스케줄러
// =========================================================================
async function startHealthCheckScheduler() {
  const checkAllRemotes = async () => {
    try {
      const remotePlugins = await db.all(
        "SELECT id, url, apiKey FROM mcp_plugins WHERE type = 'remote' AND enabled = 1"
      );
      
      await Promise.all(
        remotePlugins.map(async (p: any) => {
          try {
            await axios.get(`${p.url}/api/v1/tools`, {
              headers: { 'X-API-KEY': p.apiKey || '' },
              timeout: 2000 // 핑 스캔이므로 타이트하게 2초 타임아웃 제한
            });
            globalOnlineStates[p.id] = true; // 🟢 가동 확인
          } catch {
            globalOnlineStates[p.id] = false; // 🔴 유실 확정
          }
        })
      );
      console.log('🎯 [Health Cache] 원격 플러그인 생사 스캔 최신화 통과:', globalOnlineStates);
    } catch (e) {
      console.error('Health Check 스케줄러 링 배치 오류:', e);
    }
  };

  // 초기 로드 시점에 즉각 1회 검증 이후 1분마다 인터벌 순환
  await checkAllRemotes();
  setInterval(checkAllRemotes, 60000);
}

function registerIpcHandlers() {
  ipcMain.handle('mcp:get-tools', async () => await pluginManager.getAllToolsForLlm(''));
  ipcMain.handle('get-mcp-plugins-list', async () => await pluginManager.getPluginsConfigList());

  ipcMain.handle('remove-mcp-plugin', async (_, pluginId: string) => {
    try { 
      await pluginManager.removePlugin(pluginId); 
      // 캐시 맵에서도 찌꺼기가 남지 않게 제거
      if (globalOnlineStates[pluginId] !== undefined) delete globalOnlineStates[pluginId];
      return { success: true }; 
    }
    catch (error: any) { return { success: false, error: error.message }; }
  });

  // =========================================================================
  // 💡 [통합] 단일 창구로 진화한 플러그인 등록 가동 핸들러 (버전 수급 기능 이식)
  // =========================================================================
  ipcMain.handle('mcp:add-plugin', async (_event, config) => {
    try {
      const pluginsDir = path.join(app.getPath('userData'), 'external_plugins');
      await fsPromises.mkdir(pluginsDir, { recursive: true });

      let targetFilePath = config.url;
      
      if (config.type === 'custom' && targetFilePath) {
        const pluginId = config.id || `custom-${Date.now()}`;
        const ext = path.extname(targetFilePath) || '.js';
        const filename = `${pluginId}${ext}`;
        const destinationPath = path.join(pluginsDir, filename);

        if (targetFilePath.startsWith('http://') || targetFilePath.startsWith('https://')) {
          const response = await axios.get(targetFilePath, { responseType: 'text' });
          await fsPromises.writeFile(destinationPath, response.data, 'utf-8');
          targetFilePath = destinationPath;
        } 
        else if (fs.existsSync(targetFilePath) && !targetFilePath.includes('external_plugins')) {
          // 💡 이미 격리 폴더에 들어있는 파일이 아닐 때만 격리 복사 수행 (수정 시 오동작 방지)
          await fsPromises.copyFile(targetFilePath, destinationPath);
          targetFilePath = destinationPath;
        }
      }

      // 💡 [수정] 모달에서 넘겨준 수정본 workspaceDir이 있다면 우선 적용, 없다면 기존 pluginsDir 폴백
      const resolvedWorkspaceDir = config.type === 'custom'
        ? (config.workspaceDir?.trim() || pluginsDir)
        : undefined;

      const finalConfig = {
        ...config,
        url: targetFilePath,
        workspaceDir: resolvedWorkspaceDir
      };

      const tools = await pluginManager.registerNewPlugin(finalConfig);

      // =========================================================================
      // 🎯 [핀포인트 핫 리로드] 수정 저장이 일어난 직후, 
      //     해당 플러그인 인스턴스 하나만 즉시 프로세스를 내렸다가 새 경로로 재부팅시킵니다!
      // =========================================================================
      if (pluginManager && config.enabled !== false) {
        console.log(`🔄 [Main Sync] 설정 변경 감지로 인한 단일 핫 리로드 가동: ${config.name}`);
        await pluginManager.toggleSinglePlugin(config.id, false); // 메모리에서 내리고 프로세스 Kill
        await pluginManager.toggleSinglePlugin(config.id, true);  // 새 설정(Workspace)으로 프로세스 부팅
      }
      
      const loadedPlugin = (pluginManager as any).plugins.get(config.id);
      const activeVersion = loadedPlugin?.version || finalConfig.version || '1.0.0';

      return { success: true, tools, version: activeVersion };

    } catch (error: any) {
      console.error('🚨 플러그인 통합 등록 및 수정 실패:', error);
      return { success: false, error: error.message };
    }
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

  // 연쇄적 도구 호출(Multi-Tool Calling) 지원 무한 루프 프록시 엔진
  ipcMain.handle('llm:chat-proxy', async (_, { engine, messages, apiKey }) => {
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

      while (true) {
        let body: any = { model: engine.model };

        const lastMessage = currentMessages[currentMessages.length - 1];
        let textPrompt = '';
        if (lastMessage && lastMessage.content) {
          textPrompt = Array.isArray(lastMessage.content)
            ? lastMessage.content.map((c: any) => c.text || '').join(' ')
            : String(lastMessage.content);
        }
        const dynamicTools = await pluginManager.getAllToolsForLlm(textPrompt);

        if (engine.provider === 'openai') {
          body.messages = currentMessages;
          if (dynamicTools && dynamicTools.length > 0) body.tools = dynamicTools;
        } else if (engine.provider === 'anthropic') {
          body.messages = currentMessages;
          body.max_tokens = 2048;
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

        const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        const rawData = await response.json();
        if (!response.ok) throw new Error(JSON.stringify(rawData));

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

        if (engine.provider === 'anthropic') {
          const isToolUse = rawData.stop_reason === 'tool_use' || rawData.content?.some((b: any) => b.type === 'tool_use');

          if (!isToolUse) {
            const textBlock = rawData.content?.find((b: any) => b.type === 'text');
            const finalReplyText = textBlock?.text ?? '';

            return {
              success: true,
              data: {
                text: finalReplyText,
                rawMessage: { role: 'assistant', content: finalReplyText }
              }
            };
          }

          currentMessages.push({ role: 'assistant', content: rawData.content });

          const toolRequests = rawData.content.filter((b: any) => b.type === 'tool_use');
          const toolResultsBlocks: any[] = [];

          for (const req of toolRequests) {
            console.log(`⚙️ [MCP 루프] Claude 도구 가동: ${req.name}`);
            const toolResult = await pluginManager.routeCallTool(req.name, req.input, mainWindow!);

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

          currentMessages.push({ role: 'user', content: toolResultsBlocks });
          continue;
        }

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

  // --- 세션 및 데이터 핸들러 ---
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

  ipcMain.handle('mcp:open-file-dialog', async () => {
    if (!mainWindow) return { canceled: true, filePaths: [] };
    return await dialog.showOpenDialog(mainWindow, {
      title: 'MCP 플러그인 스크립트 파일 선택',
      filters: [{ name: 'JavaScript Files', extensions: ['mjs', 'js'] }],
      properties: ['openFile']
    });
  });

  // 💡 [Health Cache 리팩토링] 프론트엔드 실시간 핑 요쳥 시 스케줄러가 보관한 캐시맵 즉시 조회 토스
  ipcMain.handle('mcp:check-remote-status', async (_, { url, apiKey }) => {
    try {
      const row = await db.get("SELECT id FROM mcp_plugins WHERE url = ?", [url]);
      if (row && globalOnlineStates[row.id] !== undefined) {
        return globalOnlineStates[row.id];
      }
      
      // 혹시 명세 저장 전인 가상 임시 등록 단계 주소일 경우를 위한 폴백(Fallback) 일회성 동적 조회 유지
      await axios.get(`${url}/api/v1/tools`, { 
        headers: { 'X-API-KEY': apiKey || '' }, 
        timeout: 2000 
      });
      return true;
    } catch (error) {
      return false;
    }
  });

  // =========================================================================
  // 🎯 [단일 조준 최적화 리팩토링] 전체 리로드를 방지하고 핀포인트 제어 가동
  // =========================================================================
  ipcMain.handle('mcp:toggle-plugin', async (_, { pluginId, enabled }) => {
    try {
      // 1. DB 상태 즉시 업데이트 (1 또는 0)
      await db.run(
        'UPDATE mcp_plugins SET enabled = ? WHERE id = ?',
        [enabled ? 1 : 0, pluginId]
      );

      // 2. ❌ 무거운 loadPlugins() 전체 스캔을 도려내고 단일 모듈만 조준 타격 제어
      if (pluginManager) {
        await pluginManager.toggleSinglePlugin(pluginId, enabled);
      }

      // 3. 만약 원격 플러그인을 끈 거라면 전역 헬스 캐시 맵에서도 즉시 제거하여 청소
      if (!enabled && globalOnlineStates[pluginId] !== undefined) {
        delete globalOnlineStates[pluginId];
      }

      return { success: true };
    } catch (error: any) {
      console.error('🚨 플러그인 토글 처리 실패:', error);
      return { success: false, error: error.message };
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
  db = await initDb();
  await migrateEngines();
  
  // 💡 플러그인을 활성화하여 로드하기 전에 샌드박스 폴더 환경을 먼저 준비합니다.
  await prepareExternalPluginsEnv();
  
  pluginManager = new McpPluginManager(db);
  await pluginManager.loadPlugins();

  // 모든 리모트 인프라 인스턴스 정보가 보관 완료된 직후 60초 백그라운드 스케줄러 가동
  await startHealthCheckScheduler();

  registerIpcHandlers();
  createWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });