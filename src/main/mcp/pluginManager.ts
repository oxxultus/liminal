// src/main/mcp/pluginManager.ts
import * as path from 'path';
import { McpPlugin, PluginConfig } from './types';
import { RemoteHttpMcpPlugin } from '../plugins/remotePlugin';
import { Database } from 'sqlite';
import { StdioMcpPlugin } from '../plugins/stdioMcpPlugin';

export class McpPluginManager {
  private plugins: Map<string, McpPlugin> = new Map();
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  // 앱 시작 시 DB에서 enabled 플러그인 전부 메모리에 올리기
  async loadPlugins(): Promise<void> {
    try {
      const configs: PluginConfig[] = await this.db.all(
        'SELECT * FROM mcp_plugins WHERE enabled = 1'
      );
      for (const config of configs) {
        await this.initializePlugin(config);
      }
      console.log('📦 플러그인 DB에서 로드 완료');
    } catch (error) {
      console.error('플러그인 로드 실패:', error);
    }
  }

  // 새 플러그인 등록: 초기화 → 도구 검증 → DB 저장
  async registerNewPlugin(config: PluginConfig): Promise<any[]> {
    const scriptPath = (config as any).scriptPath || config.url;
    const workspaceDir = config.workspaceDir?.trim();

    // 키워드 배열 → DB 저장용 문자열 변환
    const keywordsStr = Array.isArray(config.keywords) 
      ? config.keywords.join(',') 
      : (config.keywords || '');

    // 플러그인 초기화
    const plugin = await this.initializePlugin({
      ...config,
      url: scriptPath,
      workspaceDir: workspaceDir || undefined,
    });

    const tools = await plugin.listTools();

    if (tools.length === 0 && config.type === 'remote') {
      this.plugins.delete(config.id);
      throw new Error('플러그인 연결 실패 또는 사용 가능한 도구가 없습니다.');
    }

    // DB 저장 (UPSERT)
    await this.db.run(
      `INSERT INTO mcp_plugins (id, type, name, url, apiKey, workspaceDir, keywords, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(id) DO UPDATE SET
         type = excluded.type,
         name = excluded.name,
         url = excluded.url,
         apiKey = excluded.apiKey,
         workspaceDir = excluded.workspaceDir,
         keywords = excluded.keywords,
         enabled = 1`,
      [
        config.id,
        config.type,
        config.name,
        scriptPath ?? null,
        config.apiKey ?? null,
        workspaceDir ?? null,
        keywordsStr,
      ]
    );

    return tools;
  }

  // 플러그인 목록 조회: DB에서 직접 읽기
  async getPluginsConfigList(): Promise<PluginConfig[]> {
    const rows = await this.db.all('SELECT * FROM mcp_plugins');
    return rows.map(r => ({
      ...r,
      enabled: r.enabled === 1,
      keywords: r.keywords 
        ? r.keywords.split(',').map((k: string) => k.trim()).filter(Boolean) 
        : []
    }));
  }

  // 플러그인 삭제
  async removePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (plugin && typeof (plugin as StdioMcpPlugin).kill === 'function') {
      (plugin as StdioMcpPlugin).kill();
    }
    this.plugins.delete(pluginId);
    await this.db.run('DELETE FROM mcp_plugins WHERE id = ?', [pluginId]);
  }

  // 내부 인스턴스 생성 유틸리티
  private async initializePlugin(config: PluginConfig): Promise<McpPlugin> {
    if (config.type === 'remote') {
      if (!config.url) {
        throw new Error(`Remote 플러그인에 URL이 없습니다: ${config.name}`);
      }
      return new RemoteHttpMcpPlugin(
        config.id, 
        config.name, 
        config.url, 
        config.apiKey || ''
      );
    }

    // local 또는 custom 타입 (workspaceDir은 선택사항)
    const scriptPath = (config as any).scriptPath || config.url;
    if (!scriptPath) {
      throw new Error(`스크립트 경로가 없습니다: ${config.name}`);
    }

    const workspaceDir = config.workspaceDir?.trim() || undefined;

    // StdioMcpPlugin 생성 (workspaceDir은 undefined일 수 있음)
    const plugin = new StdioMcpPlugin(
      config.id,
      config.name,
      scriptPath,
      workspaceDir
    );

    this.plugins.set(config.id, plugin);
    return plugin;
  }

  /**
   * LLM에게 전달할 도구 목록 (동적 필터링)
   */
  async getAllToolsForLlm(userPrompt: string = ''): Promise<any[]> {
    const allTools: any[] = [];
    const lowerPrompt = userPrompt.toLowerCase().trim();
    
    const configs = await this.getPluginsConfigList();

    for (const plugin of this.plugins.values()) {
      if (!plugin.enabled) continue;

      const config = configs.find(c => c.id === plugin.id);
      
      // DB에 저장된 키워드
      const dbKeywords = config?.keywords || [];
      
      // 스크립트 내부 키워드 (향후 확장용)
      const scriptKeywords = (plugin as any).pluginModule?.keywords || [];

      const finalKeywords = Array.from(new Set([...dbKeywords, ...scriptKeywords]));

      let isMatched = false;
      
      if (!lowerPrompt) {
        isMatched = true;                    // 프롬프트가 없으면 모두 포함
      } else if (finalKeywords.length === 0) {
        isMatched = true;                    // 키워드가 없으면 상시 활성화
      } else {
        isMatched = finalKeywords.some(keyword => 
          lowerPrompt.includes(keyword.toLowerCase())
        );
      }

      if (!isMatched) {
        console.log(`🎯 [동적 필터] 생략: ${plugin.name}`);
        continue;
      }

      console.log(`🔥 [동적 필터] 포함: ${plugin.name}`);
      const tools = await plugin.listTools();
      
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

  /**
   * 도구 호출 라우팅 + 보안 확인
   */
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

    // 위험한 작업 시 사용자 승인 요청
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
}