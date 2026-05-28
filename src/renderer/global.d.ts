// src/renderer/global.d.ts

export interface IElectronAPI {
  // --- MCP 플러그인 관리 ---
  getMcpTools: () => Promise<any[]>;
  executeMcpTool: (toolName: string, args: any) => Promise<{ success: boolean; result?: any; error?: string }>;
  getMcpPluginsList: () => Promise<any[]>;
  removeMcpPlugin: (pluginId: string) => Promise<{ success: boolean; error?: string }>;
  openFileDialog: () => Promise<{ canceled: boolean; filePaths: string[] }>;

  // --- 자동화 시퀀스 파이프라인 브릿지 ---
  getAutomationSequences: () => Promise<any[]>;
  saveAutomationSequence: (payload: any) => Promise<{ success: boolean; error?: string }>;
  triggerSequenceNow: (sequenceId: string) => Promise<{ success: boolean; error?: string }>;
  deleteAutomationSequence: (sequenceId: string) => Promise<{ success: boolean; error?: string }>;
  toggleSequenceStatus: (payload: { sequenceId: string; isEnabled: boolean }) => Promise<{ success: boolean; error?: string }>;

  onSequenceStatus: (callback: (data: {
    sequenceId: string;
    status: 'running' | 'completed' | 'failed';
    stepIndex: number | null;
    error?: string;
  }) => void) => void;
  offSequenceStatus: () => void;

  
  // --- 통합 매핑 소켓 ---
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
  
  // --- 하이브리드 미디어 미디어 컴포저 인터페이스 스택 ---
  uploadLocalImage: (payload: { name: string; base64Data: string }) => Promise<{ success: boolean; localPath?: string; error?: string }>;
  deleteSessionImages: (payload: { sessionId: string }) => Promise<{ success: boolean; deletedCount?: number; error?: string }>;

  // --- 대화 요약 관리 ---
  getSummary: (sessionId: string) => Promise<{ id: string; sessionId: string; summary: string; coveredUpTo: number; createdAt: number } | null>;
  saveSummary: (args: { id: string; sessionId: string; summary: string; coveredUpTo: number }) => Promise<{ success: boolean }>;
}

// ── 💡 [탈출 완료] 상단 명시적 import를 지우고 declare global 스콥을 완전한 전역 공간으로 복원 ──
declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

// 리액트 CSS 가드 드래그 리전 타이핑 확장
declare module 'react' {
  interface CSSProperties {
    WebkitAppRegion?: 'drag' | 'no-drag';
  }
}