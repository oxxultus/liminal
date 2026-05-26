// src/renderer/global.d.ts
export interface IElectronAPI {
  // --- MCP 플러그인 관리 ---
  getMcpTools: () => Promise<any[]>;
  addMcpPlugin: (config: any) => Promise<{ success: boolean; tools?: any[]; error?: string }>;
  executeMcpTool: (toolName: string, args: any) => Promise<{ success: boolean; result?: any; error?: string }>;
  getMcpPluginsList: () => Promise<any[]>;
  removeMcpPlugin: (pluginId: string) => Promise<{ success: boolean; error?: string }>;

  // --- 엔진 관리 브릿지 ---
  getEngines: () => Promise<any[]>;
  addEngine: (engineConfig: any) => Promise<{ success: boolean; error?: string }>;
  removeEngine: (id: string) => Promise<{ success: boolean; error?: string }>;

  // --- 통합 채팅 브릿지 ---
  sendChat: (payload: { engine: any; messages: any[]; apiKey: string; tools?: any[] }) =>
    Promise<{ success: boolean; data?: any; error?: string }>;

  // --- 채팅 세션 / 메시지 관리 ---
  getSessions: () => Promise<any[]>;
  createSession: (session: { id: string; title: string; engineId: string }) => Promise<{ success: boolean }>;
  deleteSession: (sessionId: string) => Promise<{ success: boolean }>;
  updateChatSessionTitle: (args: { sessionId: string; title: string }) => Promise<{ success: boolean }>;
  getMessages: (sessionId: string) => Promise<any[]>;
  saveMessage: (message: { id: string; sessionId: string; role: string; content: string }) => Promise<{ success: boolean }>;

  // --- 대화 요약 관리 ---
  getSummary: (sessionId: string) => Promise<{ id: string; sessionId: string; summary: string; coveredUpTo: number; createdAt: number } | null>;
  saveSummary: (args: { id: string; sessionId: string; summary: string; coveredUpTo: number }) => Promise<{ success: boolean }>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}