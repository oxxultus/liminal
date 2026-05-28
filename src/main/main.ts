// src/main/main.ts
import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron';
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

// 외부 플러그인 전용 독립 의존성 환경 선제 구축
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
              timeout: 2000 
            });
            globalOnlineStates[p.id] = true; 
          } catch {
            globalOnlineStates[p.id] = false; 
          }
        })
      );
      console.log('🎯 [Health Cache] 원격 플러그인 생사 스캔 최신화 통과:', globalOnlineStates);
    } catch (e) {
      console.error('Health Check 스케줄러 링 배치 오류:', e);
    }
  };

  await checkAllRemotes();
  setInterval(checkAllRemotes, 60000);
}

function registerIpcHandlers() {
  ipcMain.handle('mcp:get-tools', async () => await pluginManager.getAllToolsForLlm(''));
  ipcMain.handle('get-mcp-plugins-list', async () => await pluginManager.getPluginsConfigList());

  ipcMain.handle('remove-mcp-plugin', async (_, pluginId: string) => {
    try { 
      await pluginManager.removePlugin(pluginId); 
      if (globalOnlineStates[pluginId] !== undefined) delete globalOnlineStates[pluginId];
      return { success: true }; 
    }
    catch (error: any) { return { success: false, error: error.message }; }
  });

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
          await fsPromises.copyFile(targetFilePath, destinationPath);
          targetFilePath = destinationPath;
        }
      }

      const resolvedWorkspaceDir = config.type === 'custom'
        ? (config.workspaceDir?.trim() || pluginsDir)
        : undefined;

      const finalConfig = {
        ...config,
        url: targetFilePath,
        workspaceDir: resolvedWorkspaceDir
      };

      const tools = await pluginManager.registerNewPlugin(finalConfig);

      if (pluginManager && config.enabled !== false) {
        console.log(`🔄 [Main Sync] 설정 변경 감지로 인한 단일 핫 리로드 가동: ${config.name}`);
        await pluginManager.toggleSinglePlugin(config.id, false); 
        await pluginManager.toggleSinglePlugin(config.id, true);  
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
          if (Array.isArray(lastMessage.content)) {
            textPrompt = lastMessage.content
              .filter((c: any) => c.type === 'text')
              .map((c: any) => c.text || '')
              .join(' ');
          } else {
            textPrompt = String(lastMessage.content);
          }
        }

        const dynamicTools = await pluginManager.getAllToolsForLlm(textPrompt);

        if (engine.provider === 'openai') {
          body.messages = currentMessages.map((m: any) => {
            if (Array.isArray(m.content)) {
              return {
                role: m.role,
                content: m.content.filter((c: any) => c.type === 'text' || c.type === 'image_url')
              };
            }
            return m;
          });
          if (dynamicTools && dynamicTools.length > 0) body.tools = dynamicTools;
          
        } else if (engine.provider === 'anthropic') {
          body.messages = currentMessages.map((m: any) => {
            if (Array.isArray(m.content)) {
              const processedContent: any[] = [];
              
              m.content.forEach((c: any) => {
                if (c.type === 'text') {
                  processedContent.push(c);
                } else if (c.type === 'image_url' && c.image_url?.url?.includes('base64,')) {
                  const [meta, base64Data] = c.image_url.url.split('base64,');
                  const mediaType = meta.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
                  processedContent.push({
                    type: 'image',
                    source: { type: 'base64', media_type: mediaType, data: base64Data }
                  });
                } else if (c.type === 'pdf_file' && c.base64Data) {
                  const rawBase64 = c.base64Data.includes('base64,') ? c.base64Data.split('base64,')[1] : c.base64Data;
                  processedContent.push({
                    type: 'document',
                    source: { type: 'base64', media_type: 'application/pdf', data: rawBase64 }
                  });
                }
              });
              
              return { role: m.role, content: processedContent };
            }
            return m;
          });
          
          body.max_tokens = 2048;
          if (dynamicTools && dynamicTools.length > 0) {
            body.tools = dynamicTools.map((t: any) => ({
              name: t.name,
              description: t.description,
              input_schema: t.input_schema
            }));
          }
          
        } else if (engine.provider === 'google') {
          body.contents = currentMessages.map((m: any) => {
            let parts: any[] = [];
            if (Array.isArray(m.content)) {
              m.content.forEach((c: any) => {
                if (c.type === 'text') {
                  parts.push({ text: c.text || '' });
                } else if (c.type === 'image_url' && c.image_url?.url?.includes('base64,')) {
                  const [meta, base64Data] = c.image_url.url.split('base64,');
                  const mimeType = meta.match(/data:([^;]+);/)?.[1] || 'image/jpeg';
                  parts.push({ inlineData: { mimeType, data: base64Data } });
                } else if (c.type === 'pdf_file' && c.base64Data) {
                  const rawBase64 = c.base64Data.includes('base64,') ? c.base64Data.split('base64,')[1] : c.base64Data;
                  parts.push({ inlineData: { mimeType: 'application/pdf', data: rawBase64 } });
                }
              });
            } else {
              parts = [{ text: String(m.content) }];
            }
            return { role: m.role === 'assistant' ? 'model' : 'user', parts };
          });
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
            return { success: true, data: { text: finalReplyText, rawMessage: { role: 'assistant', content: finalReplyText } } };
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
      return { success: false, error: '지원하지 않는 provider 구조체 chain 오류' };
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
    try {
      // 1. DB에서 모든 메시지 호출
      const rows = await db.all('SELECT * FROM messages WHERE sessionId = ? ORDER BY timestamp ASC', [sessionId]);
      
      // 2. 메시지 본문 데이터 무결성 검증 및 교정
      return rows.map((m: any) => {
        if (m.content && typeof m.content === 'string') {
          let updatedContent = m.content;

          // [핵심 보정] 
          // 1. 과거의 [IMG_PATH:file://...] 형식을 [IMG_PATH:media://...]로 변환
          // 2. 파일명에 포함된 URL 인코딩 문자(공백 등)를 렌더러가 인식할 수 있게 마커 내부를 유지하되
          //    브라우저 보안 가드에 걸리지 않도록 media:// 프로토콜로 치환
          const imagesDir = path.join(app.getPath('userData'), 'chat_images').replace(/\\/g, '/');
          
          // 정규식에서 파일명 부분에 URL 인코딩 문자(%20 등)가 와도 매칭되도록 [^\]]+ 사용
          const legacyFileRegex = new RegExp(`\\[IMG_PATH:file:\\/\\/[^\\]]*?${imagesDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\/([^\\]]+)\\]`, 'g');
          
          updatedContent = updatedContent.replace(legacyFileRegex, '[IMG_PATH:media://$1]');

          // [가드 로직] 텍스트 파싱을 방해하는 찌꺼기 [IMG_DATA:...] 마커 완전히 제거
          updatedContent = updatedContent.replace(/\[IMG_DATA:[^\]]+\]/g, '');

          return {
            ...m,
            content: updatedContent
          };
        }
        return m;
      });
    } catch (error) {
      console.error('🚨 메시지 히스토리 파싱 수급 실패:', error);
      return [];
    }
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

  // 실물 이미지를 엑스박스 없이 렌더링하기 위한 로컬 격리 복사 핸들러 (media:// 바인딩)
  ipcMain.handle('chat:upload-local-image', async (_, { name, base64Data }) => {
    try {
      const imagesDir = path.join(app.getPath('userData'), 'chat_images');
      if (!fs.existsSync(imagesDir)) {
        await fsPromises.mkdir(imagesDir, { recursive: true });
      }

      // 💡 [핵심 교정] 공백을 언더바(_)로 완전 치환 (인코딩 문제 제거)
      const safeName = name.replace(/\s+/g, '_');
      const filename = `${Date.now()}_${safeName}`;
      const destinationPath = path.join(imagesDir, filename);

      const rawBase64 = base64Data.includes('base64,') ? base64Data.split('base64,')[1] : base64Data;
      await fsPromises.writeFile(destinationPath, Buffer.from(rawBase64, 'base64'));

      return { success: true, localPath: `media://${filename}` };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // 세션 삭제 시 디스크에 방치되는 첨부 이미지들을 일괄 수거 삭제하는 핸들러 (오류 보정)
  ipcMain.handle('chat:delete-session-images', async (_, { sessionId }) => {
    try {
      // 컴파일 크래시를 방지하기 위해 정규화된 쿼리 파이프라인으로 전처리 복원 완료
      const messages = await db.all('SELECT * FROM messages WHERE sessionId = ?', [sessionId]).catch(() => []);
      
      // media:// 규격에 맞춰 정규식 스캔 보정 완료
      const imgPathRegex = /\[IMG_PATH:media:\/\/([^\]]+)\]/g;
      const fileNamesToDelete: string[] = [];

      messages.forEach((m: any) => {
        if (m.content && typeof m.content === 'string') {
          let match;
          while ((match = imgPathRegex.exec(m.content)) !== null) {
            fileNamesToDelete.push(match[1]);
          }
        }
      });

      const imagesDir = path.join(app.getPath('userData'), 'chat_images');
      let deletedCount = 0;
      for (const fileName of fileNamesToDelete) {
        const fullPath = path.join(imagesDir, fileName);
        if (fs.existsSync(fullPath)) {
          await fsPromises.unlink(fullPath);
          deletedCount++;
        }
      }

      console.log(`🧹 [가비지 컬렉터] 세션 ${sessionId}의 방치 미디어 이미지 ${deletedCount}개 소거 완료`);
      return { success: true, deletedCount };
    } catch (error: any) {
      console.error('❌ 세션 이미지 가비지 컬렉션 처리 실패:', error);
      return { success: false, error: error.message };
    }
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

  ipcMain.handle('mcp:check-remote-status', async (_, { url, apiKey }) => {
    try {
      const row = await db.get("SELECT id FROM mcp_plugins WHERE url = ?", [url]);
      if (row && globalOnlineStates[row.id] !== undefined) {
        return globalOnlineStates[row.id];
      }
      
      await axios.get(`${url}/api/v1/tools`, { 
        headers: { 'X-API-KEY': apiKey || '' }, 
        timeout: 2000 
      });
      return true;
    } catch (error) {
      return false;
    }
  });

  ipcMain.handle('mcp:toggle-plugin', async (_, { pluginId, enabled }) => {
    try {
      await db.run(
        'UPDATE mcp_plugins SET enabled = ? WHERE id = ?',
        [enabled ? 1 : 0, pluginId]
      );

      if (pluginManager) {
        await pluginManager.toggleSinglePlugin(pluginId, enabled);
      }

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
  protocol.handle('media', (request) => {
    const fileUrl = request.url.replace('media://', '');
    const imagesDir = path.join(app.getPath('userData'), 'chat_images');
    const safePath = path.join(imagesDir, fileUrl); // 직접 결합

    if (safePath.startsWith(imagesDir) && fs.existsSync(safePath)) {
      return net.fetch(`file://${safePath}`);
    }
    return new Response('Not Found', { status: 404 });
  });

  db = await initDb();
  await migrateEngines();
  await prepareExternalPluginsEnv();
  
  pluginManager = new McpPluginManager(db);
  await pluginManager.loadPlugins();

  await startHealthCheckScheduler();

  registerIpcHandlers();
  createWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });