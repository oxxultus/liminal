// src/main/plugins/remotePlugin.ts

import axios from 'axios';
import { McpPlugin, McpTool, McpToolResult } from '../mcp/types';

export class RemoteHttpMcpPlugin implements McpPlugin {
  id: string;
  name: string;
  enabled: boolean;
  private baseUrl: string;
  private apiKey: string;

  constructor(id: string, name: string, url: string, apiKey: string) {
    this.id = id;
    this.name = name;
    this.baseUrl = url;
    this.apiKey = apiKey;
    this.enabled = true;
  }

  // 라즈베리파이 FastAPI의 /api/v1/tools 에서 도구 명세를 가져와 네임스페이스를 바인딩합니다.
  async listTools(): Promise<McpTool[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/tools`, {
        headers: { 'X-API-KEY': this.apiKey },
        timeout: 3000 // 3초 내에 응답 없으면 타임아웃
      });

      // 도구 명세 규격 호환 및 네임스페이스 주입
      return response.data.tools.map((tool: any) => ({
        name: `${this.id}__${tool.name}`,
        description: tool.description,
        inputSchema: tool.inputSchema || tool.parameters // MCP 스펙(inputSchema)과 OpenAI 스펙 보정
      }));
    } catch (error) {
      console.error(`[${this.name}] 원격 도구 목록 가져오기 실패:`, error);
      return [];
    }
  }

  // LLM이 호출한 도구 명령을 라즈베리파이로 전달합니다.
  async callTool(name: string, args: Record<string, any>): Promise<McpToolResult> {
    // 호출된 이름에서 접두사를 제거해 원래 이름 복원 (예: raspi1__set_temperature -> set_temperature)
    const originalName = name.replace(`${this.id}__`, '');

    try {
      const response = await axios.post(`${this.baseUrl}/api/v1/tools/execute`, {
        name: originalName,
        arguments: args
      }, {
        headers: { 
          'Content-Type': 'application/json',
          'X-API-KEY': this.apiKey 
        }
      });

      return response.data;
    } catch (error: any) {
      return {
        content: [{ type: 'text', text: `❌ 원격 제어 실패 (${this.name}): ${error.message}` }]
      };
    }
  }
}