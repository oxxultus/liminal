// src/main/mcp/pluginManager.ts
import * as path from 'path';
import * as fs from 'fs'; 
import { McpPlugin, PluginConfig } from './types';
import { RemoteHttpMcpPlugin } from '../plugins/remotePlugin';
import { Database } from 'sqlite';
import { StdioMcpPlugin } from '../plugins/stdioMcpPlugin';
import { globalOnlineStates } from '../main';

export class McpPluginManager {
  private plugins: Map<string, McpPlugin> = new Map();
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  // =========================================================================
  // 💡 [안전 장치] 앱 구동 시 실물 스크립트 파일 유실 여부 검증
  // =========================================================================
  async loadPlugins(): Promise<void> {
    try {
      const configs: PluginConfig[] = await this.db.all(
        'SELECT * FROM mcp_plugins WHERE enabled = 1'
      );
      
      for (const config of configs) {
        if (config.type === 'custom' && config.url) {
          if (!fs.existsSync(config.url)) {
            console.warn(`⚠️ [플러그인 복원 무시] 물리 파일이 존재하지 않아 로드를 스킵합니다: ${config.name} (${config.url})`);
            continue; 
          }
        }

        await this.initializePlugin(config);
      }
      console.log('📦 플러그인 DB에서 로드 완료');
    } catch (error) {
      console.error('플러그인 로드 실패:', error);
    }
  }

  async registerNewPlugin(config: PluginConfig): Promise<any[]> {
    const scriptPath = config.url || (config as any).scriptPath;
    const workspaceDir = config.workspaceDir?.trim();
    const finalVersion = config.version || '1.0.0';

    const keywordsStr = Array.isArray(config.keywords)
      ? config.keywords.join(',')
      : (config.keywords || '');

    const plugin = await this.initializePlugin({
      ...config,
      url: scriptPath,
      workspaceDir: workspaceDir || undefined,
    });

    const tools = await plugin.listTools();

    // =========================================================================
    // 💡 [수정] 통신 파이프라인(listTools)을 통과하며 인터셉트 파싱된 
    //     실물 최신 버전 정보(plugin.version)를 확실하게 취득합니다.
    // =========================================================================
    const discoveredVersion = (plugin as any).version || finalVersion;

    if (tools.length === 0 && config.type === 'remote') {
      this.plugins.delete(config.id);
      throw new Error('플러그인 연결 실패 또는 사용 가능한 도구가 없습니다.');
    }

    await this.db.run(
      `INSERT INTO mcp_plugins (id, type, name, url, apiKey, workspaceDir, keywords, version, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(id) DO UPDATE SET
         type = excluded.type,
         name = excluded.name,
         url = excluded.url,
         apiKey = excluded.apiKey,
         workspaceDir = excluded.workspaceDir,
         keywords = excluded.keywords,
         version = excluded.version,
         enabled = 1`,
      [
        config.id,
        config.type,
        config.name,
        scriptPath ?? null,
        config.apiKey ?? null,
        workspaceDir ?? null,
        keywordsStr,
        discoveredVersion // 💡 최신 동적 파싱 버전으로 영구 저장
      ]
    );

    return tools;
  }

  async getPluginsConfigList(): Promise<PluginConfig[]> {
    const rows = await this.db.all('SELECT * FROM mcp_plugins');
    return rows.map(r => ({
      ...r,
      enabled: r.enabled === 1,
      version: r.version || '1.0.0',
      keywords: r.keywords
        ? r.keywords.split(',').map((k: string) => k.trim()).filter(Boolean)
        : []
    }));
  }

  async removePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (plugin && typeof (plugin as StdioMcpPlugin).kill === 'function') {
      (plugin as StdioMcpPlugin).kill();
    }
    this.plugins.delete(pluginId);

    try {
      const pluginConfig = await this.db.get(
        'SELECT type, url FROM mcp_plugins WHERE id = ?',
        [pluginId]
      );

      if (pluginConfig && pluginConfig.type === 'custom' && pluginConfig.url) {
        if (fs.existsSync(pluginConfig.url)) {
          await fs.promises.unlink(pluginConfig.url);
          console.log(`🗑️ 외부 플러그인 물리 스크립트 파일 삭제 완료: ${pluginConfig.url}`);
        }
      }
    } catch (fileError) {
      console.error('⚠️ 플러그인 실물 파일 삭제 중 오류 발생:', fileError);
    }

    await this.db.run('DELETE FROM mcp_plugins WHERE id = ?', [pluginId]);
    console.log(`✅ 플러그인 레지스트리 제거 완료 (ID: ${pluginId})`);
  }

  private async initializePlugin(config: PluginConfig): Promise<McpPlugin> {
    if (config.type === 'remote') {
      if (!config.url) {
        throw new Error(`Remote 플러그인에 URL이 없습니다: ${config.name}`);
      }
      const plugin = new RemoteHttpMcpPlugin(
        config.id,
        config.name,
        config.url,
        config.apiKey || ''
      );
      if (config.version) {
        (plugin as any).version = config.version;
      }
      this.plugins.set(config.id, plugin);
      return plugin;
    }

    const scriptPath = config.url || (config as any).scriptPath;
    if (!scriptPath) {
      throw new Error(`스크립트 경로가 없습니다: ${config.name}`);
    }

    const workspaceDir = config.workspaceDir?.trim() || path.dirname(scriptPath);

    const plugin = new StdioMcpPlugin(
      config.id,
      config.name,
      scriptPath,
      workspaceDir
    );

    // 💡 [추가] 초기 세팅 로드 시 기존 DB에 보관중이던 백업 버전을 임시 동기화 바인딩
    if (config.version) {
      (plugin as any).version = config.version;
    }

    this.plugins.set(config.id, plugin);
    return plugin;
  }

  async getAllToolsForLlm(userPrompt: string = ''): Promise<any[]> {
    const allTools: any[] = [];
    const lowerPrompt = userPrompt.toLowerCase().trim();

    const configs = await this.getPluginsConfigList();

    for (const plugin of this.plugins.values()) {
      if (!plugin.enabled) continue;

      const config = configs.find(c => c.id === plugin.id);

      if (config?.type === 'remote') {
        const isOnline = globalOnlineStates[plugin.id];
        if (isOnline === false) {
          console.log(`🎯 [Health Cache 컷] 원격 서버 단절 상태 감지 (Skip): ${plugin.name}`);
          continue;
        }
      }

      const dbKeywords = config?.keywords || [];
      const scriptKeywords = (plugin as any).scriptKeywords || [];
      const finalKeywords = Array.from(new Set([...dbKeywords, ...scriptKeywords]));

      let isMatched = false;

      if (!lowerPrompt) {
        isMatched = true;
      } else if (finalKeywords.length === 0) {
        isMatched = true;
      } else {
        isMatched = finalKeywords.some(keyword =>
          lowerPrompt.includes(keyword.toLowerCase())
        );
      }

      if (!isMatched) {
        console.log(`🎯 [동적 필터] 생략: ${plugin.name}`);
        continue;
      }

      console.log(`🔥 [동적 필터] 포함 및 도구 수급 요청: ${plugin.name}`);
      const tools = await plugin.listTools();

      // =========================================================================
      // 💡 [신규 추가] 챗 백그라운드 루프가 돌며 도구를 새로 수급(listTools)해올 때, 
      //     실시간 파싱되어 업데이트된 플러그인의 버전을 포착하여 즉각 SQLite DB에 강제 동기화합니다.
      // =========================================================================
      const currentRuntimeVersion = (plugin as any).version || '1.0.0';
      if (config && config.version !== currentRuntimeVersion) {
        await this.db.run('UPDATE mcp_plugins SET version = ? WHERE id = ?', [currentRuntimeVersion, plugin.id]);
        console.log(`🔄 [Runtime Sync] ${plugin.name} 플러그인의 버전을 DB에 즉시 갱신함: ${currentRuntimeVersion}`);
      }

      for (const tool of tools) {
        const rawName = tool.name || 'unknown_tool';
        const rawDescription = tool.description || '';
        const rawSchema = tool.inputSchema || { type: 'object', properties: {} };

        const prefix = `${plugin.id}__`;
        const fullToolName = rawName.startsWith(prefix) ? rawName : `${prefix}${rawName}`;

        allTools.push({
          name: fullToolName,
          description: rawDescription,
          input_schema: rawSchema
          
        });
      }
    }

    console.log(`🤖 LLM 주입용 최종 도구 목록 매핑 완료 (${allTools.length}개)`);
    return allTools;
  }

  async routeCallTool(fullToolName: string, args: Record<string, any>, mainWindow?: any) {
    let pluginId = '';
    if (fullToolName.includes('__')) {
      [pluginId] = fullToolName.split('__');
    } else {
      for (const [id, plugin] of this.plugins.entries()) {
        const tools = await plugin.listTools();
        if (tools.some(t => t.name === fullToolName || t.name.endsWith(`__${fullToolName}`))) {
          pluginId = id;
          break;
        }
      }
    }

    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`플러그인을 찾을 수 없습니다: ${fullToolName}`);
    }

    const targetName = fullToolName.includes('__') ? fullToolName.split('__')[1] : fullToolName;

    if (mainWindow && (targetName === 'write_text_file' || targetName === 'delete_file')) {
      const { dialog } = require('electron');

      const rawContent = args.content || '(내용 없음)';
      const lines = rawContent.split('\n');

      let processedContent = rawContent;
      if (lines.length > 7) {
        const topSeven = lines.slice(0, 5).join('\n');
        processedContent = [
          topSeven,
          `\n... (하략) ...`,
          `📑 [전체 ${lines.length}줄 중 상위 7줄만 표시]`
        ].join('\n');
      }

      const userResponse = await dialog.showMessageBox(mainWindow, {
        type: 'warning',
        buttons: ['승인 (Execute)', '거부 (Cancel)'],
        defaultId: 0,
        cancelId: 1,
        message: `AI가 시스템 변경을 요청했습니다.`,
        detail: [
          `▶ 플러그인: ${plugin.name}`,
          `▶ 도구: ${targetName}`,
          `▶ 파일: ${args.filename || 'N/A'}`,
          `─────────────────────`,
          `[내용 미리보기]`,
          processedContent
        ].join('\n'),
      });

      if (userResponse.response === 1) {
        return {
          content: [{
            type: 'text',
            text: `❌ 사용자가 보안 정책으로 인해 도구(${targetName}) 실행을 거부했습니다.`
          }]
        };
      }
    }

    return await plugin.callTool(fullToolName, args);
  }

  async toggleSinglePlugin(pluginId: string, enabled: boolean): Promise<void> {
    try {
      if (!enabled) {
        const plugin = this.plugins.get(pluginId);
        if (plugin) {
          if (typeof (plugin as any).kill === 'function') {
            (plugin as any).kill();
          }
          this.plugins.delete(pluginId);
          console.log(`🔌 [PluginManager] 플러그인 메모리 해제 완료: ${pluginId}`);
        }
        return;
      }

      const config = await this.db.get('SELECT * FROM mcp_plugins WHERE id = ?', [pluginId]);
      if (!config) throw new Error('존재하지 않는 플러그인 레코드입니다.');

      if (config.type === 'custom' && config.url && !fs.existsSync(config.url)) {
        console.warn(`⚠️ [단독 활성화 실패] 물리 파일이 디스크에 없습니다: ${config.url}`);
        return;
      }

      const plugin = await this.initializePlugin({
        ...config,
        enabled: true,
        version: config.version || '1.0.0', 
        keywords: config.keywords ? config.keywords.split(',').map((k: string) => k.trim()).filter(Boolean) : []
      });

      // 💡 단독 로딩 핫 리로드 활성화 직후 tools 목록을 한 번 긁어주어, 내부 버전 수급 차단 파이프라인 가동 유발
      await plugin.listTools();
      const currentRuntimeVersion = (plugin as any).version || '1.0.0';
      if (config.version !== currentRuntimeVersion) {
        await this.db.run('UPDATE mcp_plugins SET version = ? WHERE id = ?', [currentRuntimeVersion, pluginId]);
      }

      console.log(`🚀 [PluginManager] 플러그인 단독 메모리 적재 성공 (버전 동기화 마감): ${config.name} (v${currentRuntimeVersion})`);

    } catch (error) {
      console.error(`플러그인 단독 토글 프로세스 처리 중 오류:`, error);
      throw error;
    }
  }
}