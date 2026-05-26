// src/main/plugins/externalPlugin.ts
import { createRequire } from 'module'; // 💡 ASAR 패키징 이후의 동적 require 경로 유실 방지용
import { McpPlugin, McpTool, McpToolResult } from '../mcp/types';

export class ExternalMcpPlugin implements McpPlugin {
  id: string;
  name: string;
  enabled: boolean;
  public filePath: string; // 💡 [추가] pluginManager에서 이 경로를 읽어 require.cache를 정밀 타격할 수 있도록 공개 필드로 노출합니다.
  private pluginModule: any;
  private context: Record<string, any>;

  constructor(id: string, name: string, filePath: string, context: Record<string, any> = {}) {
    this.id = id;
    this.name = name;
    this.filePath = filePath; // 💡 넘어온 절대 경로를 인스턴스에 저장
    this.enabled = true;
    this.context = context;

    try {
      // 💡 일렉트론 빌드 배포 후 디스크 외부 절대경로 파일 로딩을 보장하는 정석 패턴
      const customRequire = createRequire(import.meta.url || __filename);
      this.pluginModule = customRequire(filePath);
    } catch (error: any) {
      console.error(`❌ [${name}] 외부 스크립트 로드 중 에러 발생:`, error);
      throw new Error(`플러그인 모듈 컴파일 실패: ${error.message}`);
    }
  }

  async listTools(): Promise<McpTool[]> {
    try {
      if (!this.pluginModule || typeof this.pluginModule.listTools !== 'function') {
        return [];
      }

      const tools = await this.pluginModule.listTools();
      return tools.map((tool: any) => {
        // 💡 inputSchema와 input_schema 두 가지 명세 방식을 모두 방어하는 유연성 확보
        const targetSchema = tool.inputSchema || tool.input_schema || { type: 'object', properties: {} };

        return {
          name: `${this.id}__${tool.name}`, // LLM 구별용 네임스페이스 접두사 바인딩 유지
          description: tool.description || '',
          inputSchema: targetSchema
        };
      });
    } catch (error) {
      console.error(`❌ [${this.name}] 도구 명세 로드 실패:`, error);
      return [];
    }
  }

  async callTool(name: string, args: Record<string, any>): Promise<McpToolResult> {
    try {
      if (!this.pluginModule || typeof this.pluginModule.callTool !== 'function') {
        throw new Error('이 플러그인은 callTool 메서드를 구현하지 않았습니다.');
      }

      // 💡 [버그 예방] 외부 스크립트 내부로 명령을 전달할 때는 
      // 우리 시스템 내부용 접두사(예: plugin-12345__)를 완전히 도려낸 순수 도구명만 넘겨줍니다.
      const prefix = `${this.id}__`;
      const pureToolName = name.startsWith(prefix) ? name.replace(prefix, '') : name;

      // 동적 컨텍스트 환경 변수를 안전하게 전달
      return await this.pluginModule.callTool(pureToolName, args, this.context);
    } catch (error: any) {
      console.error(`❌ [${this.name}] 도구 호출중 에러 발생:`, error);
      return {
        content: [{ type: 'text', text: `❌ 플러그인 내부 실행 에러: ${error.message}` }]
      };
    }
  }
}