// src/main/mcp/pluginManager.ts
import * as path from 'path';
import { McpPlugin, PluginConfig } from './types';
import { RemoteHttpMcpPlugin } from '../plugins/remotePlugin';
import { ExternalMcpPlugin } from '../plugins/externalPlugin'; 
import { Database } from 'sqlite';

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
    const realWorkspace = config.workspaceDir;
    
    // 💡 프론트엔드에서 배열로 넘어온 키워드를 DB 저장용 콤마 문자열로 변환
    const keywordsStr = Array.isArray(config.keywords) ? config.keywords.join(',') : '';

    const plugin = await this.initializePlugin({
      ...config,
      url: scriptPath,       
      workspaceDir: realWorkspace
    });
    
    const tools = await plugin.listTools();

    if (tools.length === 0 && config.type === 'remote') {
      this.plugins.delete(config.id);
      throw new Error('플러그인 연결 실패 또는 사용 가능한 도구 없음');
    }

    // 💡 SQL 실행 인자 목록 맨 끝에 keywordsStr 추가 및 UPSERT 구문에 keywords 대치 추가
    await this.db.run(
      `INSERT INTO mcp_plugins (id, type, name, url, apiKey, workspaceDir, keywords, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type, name = excluded.name,
        url = excluded.url, apiKey = excluded.apiKey,
        workspaceDir = excluded.workspaceDir, 
        keywords = excluded.keywords, 
        enabled = 1`,
      [
        config.id, config.type, config.name, scriptPath ?? null, 
        config.apiKey ?? null, realWorkspace ?? null, keywordsStr,
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
      // 💡 DB에 저장되어 있던 "파일,메모" 텍스트를 다시 ['파일', '메모'] 배열로 파싱하여 프론트/필터에 전달
      keywords: r.keywords ? r.keywords.split(',') : [] 
    }));
  }

  // 플러그인 삭제: 메모리 + DB + Node.js 런타임 캐시 완전 청소
  async removePlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    
    if (plugin) {
      try {
        // 1. ExternalMcpPlugin 내부에 스크립트 물리 경로가 열려있다면 정밀 타격 청소
        if ((plugin as any).filePath) {
          const targetPath = (plugin as any).filePath;
          if (require.cache[targetPath]) {
            delete require.cache[targetPath];
            console.log(`🧼 [캐시 킬러] 정밀 타격 모듈 캐시 삭제 성공: ${targetPath}`);
          }
        }

        // 2. 전역 캐시 레지스트리 스캔 및 완벽 해제
        const resolvedId = pluginId.replace('plugin-', '');
        Object.keys(require.cache).forEach((cacheKey) => {
          if (
            cacheKey.includes(pluginId) || 
            cacheKey.includes(resolvedId) ||
            cacheKey.endsWith(`${pluginId}.js`)
          ) {
            delete require.cache[cacheKey];
            console.log(`🧼 [캐시 킬러] 런타임 스캔 모듈 캐시 완전 해제: ${cacheKey}`);
          }
        });
      } catch (cacheError) {
        console.warn('⚠️ 플러그인 모듈 캐시 청소 중 사소한 예외 예방 처리:', cacheError);
      }
    }

    // 메모리 맵 및 DB 테이블 레코드 청소 파이프라인
    this.plugins.delete(pluginId);
    await this.db.run('DELETE FROM mcp_plugins WHERE id = ?', [pluginId]);
    console.log(`🗑️ 플러그인 [${pluginId}] 제거 완료 (메모리, DB, 캐시 청소 전체 종료)`);
  }

  // 내부 인스턴스 생성 유틸리티
  private async initializePlugin(config: PluginConfig): Promise<McpPlugin> {
    let plugin: McpPlugin;

    if (config.type === 'remote') {
      plugin = new RemoteHttpMcpPlugin(config.id, config.name, config.url!, config.apiKey!);
    } else if (config.type === 'custom') {
      const scriptPath = (config as any).scriptPath || config.url; 
      const realWorkspace = config.workspaceDir; 

      if (!scriptPath) {
        throw new Error(`플러그인 [${config.name}] 초기화 실패: 스크립트 파일 경로가 유실되었습니다.`);
      }
      
      plugin = new ExternalMcpPlugin(
        config.id, 
        config.name, 
        scriptPath,
        { workspaceDir: realWorkspace } 
      );
    } else {
      throw new Error('지원하지 않는 플러그인 타입입니다.');
    }

    this.plugins.set(config.id, plugin);
    return plugin;
  }

  /**
   * 💡 [고도화 반영] 유저의 질문 내용을 분석하여 연관된 플러그인의 도구만 동적으로 반환합니다.
   * @param userPrompt 사용자가 입력한 대화 본문
   */
  async getAllToolsForLlm(userPrompt: string = ''): Promise<any[]> {
    const allTools: any[] = [];
    const lowerPrompt = userPrompt.toLowerCase().trim();
    
    const configs = await this.getPluginsConfigList();

    for (const plugin of this.plugins.values()) {
      if (!plugin.enabled) continue;

      const config = configs.find(c => c.id === plugin.id);
      
      // 💡 [안전망 레이어 1] UI/DB 기반 설정 키워드 추출
      const dbKeywords = config?.keywords || [];
      
      // 💡 [안전망 레이어 2] 자바스크립트 파일 모듈 내부에 하드코딩된 자체 고유 키워드 목록 추출
      const scriptKeywords = (plugin as any).pluginModule?.keywords || [];
      
      // 두 그룹의 키워드를 합집합 처리하여 중복 없는 검사 풀 가동
      const finalKeywords = Array.from(new Set([...dbKeywords, ...scriptKeywords]));

      let isMatched = false;
      
      if (!lowerPrompt) {
        isMatched = true; // 최초 앱 진입이나 문맥이 없을 때는 일단 전부 주입
      } else if (finalKeywords.length === 0) {
        // 💡 [억까 방어 핵심] 설정한 키워드가 아예 없는 플러그인은 무조건 상시 대기조(true)로 판단하여 통과시킵니다.
        isMatched = true; 
      } else {
        // 동의어 누락 방지를 위해 등록된 키워드 중 단 하나라도 매칭되면 주입 대상으로 선정
        isMatched = finalKeywords.some(keyword => lowerPrompt.includes(keyword.toLowerCase()));
      }

      if (!isMatched) {
        console.log(`🎯 [동적 필터] 질문과 연관성 낮음 - 플러그인 생략: ${plugin.name}`);
        continue;
      }

      console.log(`🔥 [동적 필터] 연관성 감지 - 플러그인 도구 주입: ${plugin.name}`);
      const tools = await plugin.listTools();
      
      for (const tool of tools) {
        const rawName = tool.name || 'unknown_tool';
        const rawDescription = tool.description || '';
        const rawSchema = tool.inputSchema || (tool as any).function?.parameters || { type: 'object', properties: {} };

        const prefix = `${plugin.id}__`;
        const fullToolName = rawName.startsWith(prefix) ? rawName : `${prefix}${rawName}`;

        allTools.push({
          name: fullToolName,
          description: rawDescription,
          input_schema: rawSchema
        });
      }
    }
    
    console.log(`🤖 LLM 주입용 최종 도구 목록 매핑 완료 (${allTools.length}개 툴 활성화)`);
    return allTools;
  }

  /**
   * 💡 [교착 상태 해결 패치] 완전히 독립된 스레드 비동기 락을 구현하여 답변 무한 로딩을 차단합니다.
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
      throw new Error(`플러그인을 찾을 수 없습니다: ${fullToolName} (추출된 ID: ${pluginId})`);
    }

    const targetName = fullToolName.includes('__') ? fullToolName : `${pluginId}__${fullToolName}`;
    const originalName = fullToolName.includes('__') ? fullToolName.split('__')[1] : fullToolName;

    // 💡 [핵심] 파괴적인 특정 파일 쓰기/삭제 수정 명령 감지 시 비동기 백그라운드 스레드 유저 응답 락 가동
    if (mainWindow && (originalName === 'write_text_file' || originalName === 'delete_file')) {
      const { dialog } = require('electron');
      
      const rawContent = args.content || '(내용 없음)';
      const lines = rawContent.split('\n');
      
      // 💡 상위 7줄만 콤팩트하게 추출하고 나머지는 생략 기호 처리
      let processedContent = rawContent;
      if (lines.length > 7) {
        const topSevenLines = lines.slice(0, 7).join('\n');
        processedContent = [
          topSevenLines,
          `\n... (하략) ...`,
          `📑 [ 전체 ${lines.length}줄 중 상위 7줄만 미리보기 출력됨 ]`
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
          `▶ 실행 도구: ${originalName}`,
          `▶ 타겟 파일: ${args.filename || 'N/A'}`,
          `─────────────────────`,
          `[기록할 내용 미리보기]`,
          processedContent
        ].join('\n'),
      });

      if (userResponse.response === 1) {
        return {
          content: [{ type: 'text', text: `❌ 사용자가 보안 정책 위협으로 인해 해당 도구(${originalName})의 실행을 거부했습니다.` }]
        };
      }
    }

    return await plugin.callTool(targetName, args);
  }
}