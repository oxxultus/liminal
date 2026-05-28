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
  type: 'remote' | 'custom'; 
  name: string;
  url?: string;
  apiKey?: string;
  workspaceDir?: string;
  enabled: boolean;
  keywords?: string[];
  version?: string; 
}