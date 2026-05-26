// src/main/mcp/types.ts

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>; // JSON Schema 형태
}

export interface McpToolResult {
  content: Array<{ type: string; text: string }>;
}

export interface McpPlugin {
  id: string;
  name: string;
  enabled: boolean;
  listTools(): Promise<McpTool[]>;
  callTool(name: string, args: Record<string, any>): Promise<McpToolResult>;
}

// 사용자가 설정창에서 입력하고 디스크에 저장할 플러그인 설정 정보
export interface PluginConfig {
  id: string;
  type: 'remote' | 'local';
  name: string;
  url?: string;
  apiKey?: string;
  workspaceDir?: string;
  enabled: boolean;
}