// src/main/mcp/types.ts

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
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

export interface PluginConfig {
  id: string;
  type: 'remote' | 'custom'; // 💡 'local'을 완벽히 도려내어 파이프라인 단순화
  name: string;
  url?: string;
  apiKey?: string;
  workspaceDir?: string;
  enabled: boolean;
  keywords?: string[]; // 💡 [신규] 해당 플러그인을 트리거할 연관 키워드 목록
}