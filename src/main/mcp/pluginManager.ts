// src/main/mcp/pluginManager.ts

import * as path from 'path';
import { McpPlugin, PluginConfig } from './types';
import { RemoteHttpMcpPlugin } from '../plugins/remotePlugin';
import { LocalFileMcpPlugin } from '../plugins/localFilePlugin';
import { Database } from 'sqlite';  // ← db 인스턴스 타입

export class McpPluginManager {
  private plugins: Map<string, McpPlugin> = new Map();
  private db: Database;  // ← fs 대신 db 주입

  constructor(db: Database) {
    this.db = db;  // 생성자에서 db 인스턴스 받음 (fs.configPath 제거)
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
    const plugin = await this.initializePlugin(config);
    const tools = await plugin.listTools();

    if (tools.length === 0 && config.type === 'remote') {
      this.plugins.delete(config.id);
      throw new Error('플러그인 연결 실패 또는 사용 가능한 도구 없음');
    }

    // JSON 파일 대신 DB upsert
    await this.db.run(
      `INSERT INTO mcp_plugins (id, type, name, url, apiKey, workspaceDir, enabled)
       VALUES (?, ?, ?, ?, ?, ?, 1)
       ON CONFLICT(id) DO UPDATE SET
         type = excluded.type, name = excluded.name,
         url = excluded.url, apiKey = excluded.apiKey,
         workspaceDir = excluded.workspaceDir, enabled = 1`,
      [config.id, config.type, config.name,
       config.url ?? null, config.apiKey ?? null, config.workspaceDir ?? null]
    );
    return tools;
  }

  // 플러그인 목록 조회: DB에서 직접 읽기
  async getPluginsConfigList(): Promise<PluginConfig[]> {
    const rows = await this.db.all('SELECT * FROM mcp_plugins');
    // SQLite의 enabled(0/1)를 boolean으로 변환
    return rows.map(r => ({ ...r, enabled: r.enabled === 1 }));
  }

  // 플러그인 삭제: 메모리 + DB
  async removePlugin(pluginId: string): Promise<void> {
    this.plugins.delete(pluginId);
    await this.db.run('DELETE FROM mcp_plugins WHERE id = ?', [pluginId]);
    console.log(`🗑️ 플러그인 [${pluginId}] 제거 완료`);
  }

  // 내부 인스턴스 생성 유틸리티
  private async initializePlugin(config: PluginConfig): Promise<McpPlugin> {
    let plugin: McpPlugin;

    if (config.type === 'remote') {
      plugin = new RemoteHttpMcpPlugin(config.id, config.name, config.url!, config.apiKey!);
    } else if (config.type === 'local') {
      // 💡 로컬 플러그인 동적 인스턴스화
      plugin = new LocalFileMcpPlugin(config.id, config.name, config.workspaceDir!);
    } else {
      throw new Error('지원하지 않는 플러그인 타입입니다.');
    }

    this.plugins.set(config.id, plugin);
    return plugin;
  }

  // 활성화된 모든 플러그인의 도구를 모아서 OpenAI Function Calling 규격으로 변환
  // src/main/mcp/pluginManager.ts 내부 함수 수정
  async getAllToolsForLlm(): Promise<any[]> {
    const allTools: any[] = [];
    
    for (const plugin of this.plugins.values()) {
      if (!plugin.enabled) continue;
      
      // 플러그인으로부터 정식 McpTool[] 리스트 취득
      const tools = await plugin.listTools();
      
      for (const tool of tools) {
        // 💡 McpTool 인터페이스 규격을 100% 준수하여 값을 추출합니다.
        const rawName = tool.name || 'unknown_tool';
        const rawDescription = tool.description || '';
        
        // OpenAI 호환용 파라미터 구조(t.function.parameters)까지 고려하여 유연하게 스키마 획득
        const rawSchema = tool.inputSchema || (tool as any).function?.parameters || { type: 'object', properties: {} };

        // 플러그인 ID 고유 접두사 매핑 규칙 적용
        const prefix = `${plugin.id}__`;
        const fullToolName = rawName.startsWith(prefix) ? rawName : `${prefix}${rawName}`;

        // 💡 Anthropic Claude SDK가 원하는 표준 도구 명세 규격으로 포맷팅
        allTools.push({
          name: fullToolName,
          description: rawDescription,
          input_schema: rawSchema // Claude는 input_schema 라는 키 이름을 요구합니다.
        });
      }
    }
    
    console.log("🤖 LLM 주입용 최종 도구 목록 매핑 완료:", allTools);
    return allTools;
  }

  // 도구 명칭을 분해하여 해당 플러그인으로 실행 라우팅
  async routeCallTool(fullToolName: string, args: Record<string, any>) {
  // 1. 이름에 __ 가 들어있는지 확인하여 플러그인 ID 추출
  let pluginId = '';
  if (fullToolName.includes('__')) {
    [pluginId] = fullToolName.split('__');
  } else {
    // 💡 안전장치: 만약 접두사 없이 'write_text_file'만 들어왔다면,
    // 현재 활성화된 플러그인 중 해당 도구를 가지고 있는 녀석을 동적으로 찾아냅니다.
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
    throw new Error(`플러그인을 찾을 수 없습니다: ${fullToolName} (추출된 ID: ${pluginId})`);
  }

  // 원래 도구 이름 형태로 복원하여 전달하기 위해 매핑 구조 맞춤
  // 만약 이미 접두사가 붙어있다면 그대로 두고, 없다면 붙여서 보냅니다.
  const targetName = fullToolName.includes('__') ? fullToolName : `${pluginId}__${fullToolName}`;
  return await plugin.callTool(targetName, args);
  }
}