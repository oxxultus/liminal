// src/renderer/global.d.ts

export interface IElectronAPI {
  // --- MCP 플러그인 관리 ---
  getMcpTools: () => Promise<any[]>;
  executeMcpTool: (toolName: string, args: any) => Promise<{ success: boolean; result?: any; error?: string }>;
  getMcpPluginsList: () => Promise<any[]>;
  removeMcpPlugin: (pluginId: string) => Promise<{ success: boolean; error?: string }>;
  openFileDialog: () => Promise<{ canceled: boolean; filePaths: string[] }>;
  
  // =========================================================================
  // 💡 [정리 병합] 하단에 따로 놀던 중복 선언 소켓을 완벽하게 통합 매핑 마감
  // =========================================================================
  addMcpPlugin: (config: any) => Promise<{ success: boolean; tools?: any[]; version?: string; error?: string }>;
  toggleMcpPlugin: (payload: { pluginId: string; enabled: boolean }) => Promise<{ success: boolean; error?: string }>;
  checkRemoteStatus: (payload: { url: string; apiKey: string }) => Promise<boolean>;

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
  
  // =========================================================================
  // 💡 [하이브리드 미디어 컴포저 인터페이스 스택]
  //    물리 디스크 이미지 쓰기 및 세션 가비지 컬렉터 연쇄 파쇄 핸들러 타이핑 등록
  // =========================================================================
  uploadLocalImage: (payload: { name: string; base64Data: string }) => Promise<{ success: boolean; localPath?: string; error?: string }>;
  deleteSessionImages: (payload: { sessionId: string }) => Promise<{ success: boolean; deletedCount?: number; error?: string }>;

  // --- 대화 요약 관리 ---
  getSummary: (sessionId: string) => Promise<{ id: string; sessionId: string; summary: string; coveredUpTo: number; createdAt: number } | null>;
  saveSummary: (args: { id: string; sessionId: string; summary: string; coveredUpTo: number }) => Promise<{ success: boolean }>;
}

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: 'drag' | 'no-drag';
  }
}