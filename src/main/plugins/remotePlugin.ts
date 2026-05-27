// src/main/plugins/remotePlugin.ts

import axios from 'axios';
import { McpPlugin, McpTool, McpToolResult } from '../mcp/types';

export class RemoteHttpMcpPlugin implements McpPlugin {
  id: string;
  name: string;
  enabled: boolean;
  
  // 💡 타입 호환성 및 Manager 편의를 위한 명시적 필드 선언
  public url: string; 
  public apiKey: string;
  public filePath?: string = undefined;     // 원격 타입이므로 없음
  public workspaceDir?: string = undefined; // 원격 타입이므로 없음

  constructor(id: string, name: string, url: string, apiKey: string) {
    this.id = id;
    this.name = name;
    this.url = url;
    this.apiKey = apiKey;
    this.enabled = true;
  }

  // 원격 서버(FastAPI 등)의 /api/v1/tools 에서 도구 명세를 가져와 네임스페이스를 바인딩합니다.
  async listTools(): Promise<McpTool[]> {
    try {
      const response = await axios.get(`${this.url}/api/v1/tools`, {
        headers: { 'X-API-KEY': this.apiKey },
        timeout: 5000 // 연결 컨텍스트를 고려해 5초로 약간 여유를 둡니다.
      });

      const tools = response.data?.tools ?? [];

      // 도구 명세 규격 호환 및 네임스페이스 주입
      return tools.map((tool: any) => ({
        name: `${this.id}__${tool.name}`,
        description: tool.description ?? '',
        // 💡 백엔드 규격 불일치 방어 및 Fallback 오브젝트 주입
        inputSchema: tool.inputSchema || tool.parameters || { type: 'object', properties: {} }
      }));
    } catch (error: any) {
      // 💡 앱 초기화 유연성을 위해 크래시를 내지 않고 네트워크 상태만 콘솔에 조용히 기록합니다.
      console.error(`[${this.name}] 원격 도구 목록 가져오기 실패:`, error.message);
      return [];
    }
  }

  // LLM이 호출한 도구 명령을 원격 서버로 전달합니다.
  async callTool(name: string, args: Record<string, any>): Promise<McpToolResult> {
    // 💡 StdioMcpPlugin과 동일한 방식으로 안전하게 네임스페이스 접두사 제거
    const prefix = `${this.id}__`;
    const originalName = name.startsWith(prefix) ? name.slice(prefix.length) : name;

    try {
      const response = await axios.post(`${this.url}/api/v1/tools/execute`, {
        name: originalName,
        arguments: args
      }, {
        headers: { 
          'Content-Type': 'application/json',
          'X-API-KEY': this.apiKey 
        },
        timeout: 15000 // 실행 대기 시간은 Stdio와 맞춰서 15초 제공
      });

      return response.data;
    } catch (error: any) {
      console.error(`[${this.name}] callTool 원격 전송 오류:`, error.message);

      let serverErrorMessage = error.message;

      // 💡 [네트워크 레이어 에러 정밀 인터셉트]
      // 서버가 꺼져있거나, 도메인 오타, 혹은 타임아웃이 났을 때 구체적인 에러 안내 제공
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        serverErrorMessage = "원격 서버와 통신할 수 없습니다. 서버 가동 상태 또는 URL 경로를 확인해 주세요.";
      } else if (error.code === 'ETIMEDOUT' || error.code === 'TIMEOUT') {
        serverErrorMessage = "원격 서버가 15초 이내에 응답하지 않아 타임아웃 처리되었습니다.";
      } else if (error.response?.data?.detail) {
        // 원격 서버(FastAPI 등)에서 보낸 세부 에러 바디가 있다면 추출
        serverErrorMessage = typeof error.response.data.detail === 'string'
          ? error.response.data.detail
          : JSON.stringify(error.response.data.detail);
      } else if (error.response?.data?.message) {
        serverErrorMessage = error.response.data.message;
      }

      // 💡 에러 구조체 포맷을 랩핑하여 AI가 대화창에서 유연하게 "죄송합니다, 원격 서버 에러로 인해~" 형태로 대응할 수 있게 토스
      return {
        content: [{ 
          type: 'text', 
          text: `❌ 원격 플러그인 제어 실패 (${this.name}): ${serverErrorMessage}` 
        }]
      };
    }
  }
}