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
import { McpSequenceEngine } from './mcp/sequenceEngine';

const execAsync = promisify(exec);

let mainWindow: BrowserWindow | null = null;
let db: any;
let pluginManager: McpPluginManager;
let sequenceEngine: McpSequenceEngine;

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

  if (sequenceEngine) { sequenceEngine.setMainWindow(mainWindow);}

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
              timeout: 1000 
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
        // 💡 [핵심 방어 1] 전송 직전 메시지 검증: 빈 content를 가진 메시지는 API 거부 사유가 됨
        currentMessages = currentMessages.filter((m: any) => {
          if (Array.isArray(m.content)) return m.content.length > 0;
          return m.content && String(m.content).trim().length > 0;
        });

        let body: any = { model: engine.model };
        const lastMessage = currentMessages[currentMessages.length - 1];
        let textPrompt = '';
        
        if (lastMessage?.content) {
          textPrompt = Array.isArray(lastMessage.content) 
            ? lastMessage.content.filter((c: any) => c.type === 'text').map((c: any) => c.text || '').join(' ')
            : String(lastMessage.content);
        }

        const dynamicTools = await pluginManager.getAllToolsForLlm(textPrompt);

        // 프로바이더별 body 조립 (OpenAI, Anthropic, Google)
        if (engine.provider === 'openai') {
          body.messages = currentMessages.map((m: any) => ({
            role: m.role,
            content: Array.isArray(m.content) 
              ? m.content.filter((c: any) => c.type === 'text' || c.type === 'image_url')
              : m.content
          }));
          if (dynamicTools?.length > 0) body.tools = dynamicTools;
        } else if (engine.provider === 'anthropic') {
          body.messages = currentMessages.map((m: any) => ({
            role: m.role,
            content: Array.isArray(m.content) ? m.content.map((c: any) => {
              if (c.type === 'text') return c;
              if (c.type === 'image_url') {
                const [meta, data] = c.image_url.url.split('base64,');
                return { type: 'image', source: { type: 'base64', media_type: meta.match(/data:([^;]+);/)?.[1] || 'image/jpeg', data } };
              }
              if (c.type === 'pdf_file') return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: c.base64Data.split('base64,')[1] || c.base64Data } };
              return c;
            }) : m.content
          }));
          body.max_tokens = 4096;
          if (dynamicTools?.length > 0) body.tools = dynamicTools.map((t: any) => ({ name: t.name, description: t.description, input_schema: t.input_schema }));
        } else if (engine.provider === 'google') {
          body.contents = currentMessages.map((m: any) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: Array.isArray(m.content) ? m.content.map((c: any) => {
              if (c.type === 'text') return { text: c.text };
              if (c.type === 'image_url') return { inlineData: { mimeType: 'image/jpeg', data: c.image_url.url.split('base64,')[1] } };
              if (c.type === 'pdf_file') return { inlineData: { mimeType: 'application/pdf', data: c.base64Data.split('base64,')[1] } };
              return { text: '' };
            }) : [{ text: String(m.content) }]
          }));
        }

        const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
        const rawData = await response.json();
        if (!response.ok) throw new Error(JSON.stringify(rawData));

        // [OpenAI 도구 루프]
        if (engine.provider === 'openai') {
          const assistantMessage = rawData.choices[0].message;
          if (!assistantMessage.tool_calls) return { success: true, data: { text: assistantMessage.content || '', rawMessage: assistantMessage } };
          
          currentMessages.push(assistantMessage);
          for (const tc of assistantMessage.tool_calls) {
            const res = await pluginManager.routeCallTool(tc.function.name, JSON.parse(tc.function.arguments), mainWindow!);
            currentMessages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(res) });
          }
          continue;
        }

        // [Anthropic 도구 루프]
        if (engine.provider === 'anthropic') {
          const isToolUse = rawData.content?.some((b: any) => b.type === 'tool_use');
          if (!isToolUse) return { success: true, data: { text: rawData.content[0].text, rawMessage: { role: 'assistant', content: rawData.content } } };

          currentMessages.push({ role: 'assistant', content: rawData.content });
          const toolResults = [];
          for (const block of rawData.content.filter((b: any) => b.type === 'tool_use')) {
            const res = await pluginManager.routeCallTool(block.name, block.input, mainWindow!);
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(res) });
          }
          currentMessages.push({ role: 'user', content: toolResults });
          continue;
        }

        break;
      }
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

  // 자동화 시퀀스
  ipcMain.handle('mcp:get-automation-sequences', async () => {
    try {
      const sequences = await db.all(`
        SELECT 
          q.*, 
          s.cronExpression, 
          s.lastRunTimestamp 
        FROM automation_sequences q
        LEFT JOIN automation_schedules s ON q.id = s.sequenceId
        ORDER BY q.createdAt DESC
      `);
      
      for (const seq of sequences) {
        // 💡 [추가] DB에 저장된 JSON 문자열 변수를 프론트엔드가 쓸 수 있게 파싱
        try {
          seq.variables = seq.variables ? JSON.parse(seq.variables) : [];
        } catch {
          seq.variables = [];
        }

        const steps = await db.all(
          'SELECT * FROM sequence_steps WHERE sequenceId = ? ORDER BY stepOrder ASC',
          [seq.id]
        );
        seq.steps = steps.map((step: any) => ({
          id: step.id,
          fullToolName: step.fullToolName,
          argsTemplate: step.argsTemplate,
          pluginId: step.pluginId
        }));
      }
      
      return sequences;
    } catch (e) {
      console.error("데이터 로드 실패:", e);
      return [];
    }
  });

  // 2. 특정 자동화 명세 완전 삭제 파쇄
  ipcMain.handle('mcp:delete-automation-sequence', async (_, sequenceId) => {
    await db.run('DELETE FROM automation_sequences WHERE id = ?', [sequenceId]);
    return { success: true };
  });

  // 3. 수동 즉시 단추 요청 접수 -> 이전에 만들어둔 sequenceEngine 트리거 호출
  ipcMain.handle('mcp:trigger-sequence-now', async (_, sequenceId) => {
    try {
      // 이미 메인 레벨에 가동 결합해 둔 시퀀스 엔진을 그대로 흔들어 깨웁니다.
      await sequenceEngine.executeSequence(sequenceId);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  });

  // src/main/main.ts 내부의 saveAutomationSequence 핸들러 교체
  ipcMain.handle('mcp:save-automation-sequence', async (event, payload) => {
    const { id, name, description, cronExpression, isEnabled, steps, variables } = payload;
    const enabledFlag = isEnabled === false ? 0 : 1;
    
    // 💡 [추가] 배열 형태의 변수를 DB 텍스트 필드에 넣기 위해 JSON 문자열로 직렬화
    const variablesJson = JSON.stringify(variables || []);

    try {
      await db.run('BEGIN TRANSACTION');

      const existing = await db.get('SELECT id FROM automation_sequences WHERE id = ?', [id]);

      if (existing) {
        // 💡 variables = ? 추가
        await db.run(
          `UPDATE automation_sequences 
          SET name = ?, description = ?, isEnabled = ?, variables = ?, updatedAt = ? 
          WHERE id = ?`,
          [name, description, enabledFlag, variablesJson, Date.now(), id]
        );
      } else {
        // 💡 variables 컬럼 및 데이터 바인딩 추가
        await db.run(
          `INSERT INTO automation_sequences (id, name, description, isEnabled, variables, createdAt, updatedAt) 
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, name, description, enabledFlag, variablesJson, Date.now(), Date.now()]
        );
      }

      // 3. 스케줄러 정보 동기화
      const existingSched = await db.get('SELECT id FROM automation_schedules WHERE sequenceId = ?', [id]);
      if (existingSched) {
        await db.run(
          `UPDATE automation_schedules 
          SET cronExpression = ?, isEnabled = ? 
          WHERE sequenceId = ?`,
          [cronExpression, enabledFlag, id]
        );
      } else {
        await db.run(
          `INSERT INTO automation_schedules (id, sequenceId, cronExpression, isEnabled, lastRunTimestamp) 
          VALUES (?, ?, ?, ?, NULL)`,
          [`sched-${Date.now()}`, id, cronExpression, enabledFlag]
        );
      }

      // 4. 하위 스텝들 초기화 후 재정비
      await db.run('DELETE FROM sequence_steps WHERE sequenceId = ?', [id]);
      
      for (const step of steps) {
        await db.run(
          `INSERT INTO sequence_steps (id, sequenceId, stepOrder, fullToolName, argsTemplate, pluginId, pluginType, pluginUrl, pluginApiKey, pluginWorkspaceDir) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            step.id || `step-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            id,
            step.stepOrder,
            step.fullToolName,
            step.argsTemplate,
            step.pluginId,
            step.pluginType || 'custom',
            step.pluginUrl || null,
            step.pluginApiKey || null,
            step.pluginWorkspaceDir || null
          ]
        );
      }

      await db.run('COMMIT');

      if ((globalThis as any).sequenceEngine) {
        await (globalThis as any).sequenceEngine.initializeSchedules().catch(() => {});
      }

      return { success: true };
    } catch (error: any) {
      await db.run('ROLLBACK');
      console.error('시퀀스 저장 실패:', error);
      return { success: false, error: error.message };
    }
  });
  
  ipcMain.handle('mcp:toggle-sequence-status', async (event, { sequenceId, isEnabled }) => {
    const enabledFlag = isEnabled ? 1 : 0;
    
    try {
      await db.run('BEGIN TRANSACTION');

      // 1. 마스터 테이블의 활성화 플래그만 콕 집어서 업데이트
      await db.run(
        'UPDATE automation_sequences SET isEnabled = ?, updatedAt = ? WHERE id = ?',
        [enabledFlag, Date.now(), sequenceId]
      );

      // 2. 크론 스케줄 테이블의 활성화 플래그도 세트로 업데이트
      await db.run(
        'UPDATE automation_schedules SET isEnabled = ? WHERE sequenceId = ?',
        [enabledFlag, sequenceId]
      );

      await db.run('COMMIT');

      // 3. 백그라운드 크론 엔진 알람 주기에 실시간 리로드 신호 주입
      if ((globalThis as any).sequenceEngine) {
        await (globalThis as any).sequenceEngine.initializeSchedules().catch(() => {});
      }

      return { success: true };
    } catch (error: any) {
      await db.run('ROLLBACK');
      console.error('시퀀스 상태 토글 실패:', error);
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

  // [시퀀스 자동화 엔진 장착]
  sequenceEngine = new McpSequenceEngine(
    db,
    pluginManager,
    () => globalOnlineStates
  );
  await sequenceEngine.initializeSchedules(); // 스케줄 로드

  (globalThis as any).sequenceEngine = sequenceEngine;

  await startHealthCheckScheduler();

  registerIpcHandlers();
  createWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });