// src/main/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // 1. 저장된 플러그인 목록 기반으로 LLM용 모든 도구 스펙 가져오기
  getMcpTools: () => ipcRenderer.invoke('mcp:get-tools'),

  // 2. 사용자가 UI에서 새 플러그인을 양식에 맞춰 추가할 때 호출
  addMcpPlugin: (config: any) => ipcRenderer.invoke('mcp:add-plugin', config),

  // 3. LLM이 판단한 도구 실행 명령을 백엔드로 전달하여 수행
  executeMcpTool: (toolName: string, args: any) => ipcRenderer.invoke('mcp:execute-tool', { toolName, args }),

  // 4. 현재 추가된 플러그인 설정 리스트 전체 가져오기
  getMcpPluginsList: () => ipcRenderer.invoke('get-mcp-plugins-list'),

  // 5. 특정 플러그인 삭제하기
  removeMcpPlugin: (pluginId: string) => ipcRenderer.invoke('remove-mcp-plugin', pluginId),

  // 🎯 [신규 엔진 관리 브릿지]: 하드코딩된 API키 관리 대신 동적 엔진 명세 관리로 전환
  getEngines: () => ipcRenderer.invoke('llm:get-engines'),
  addEngine: (engineConfig: any) => ipcRenderer.invoke('llm:add-engine', engineConfig),
  removeEngine: (id: string) => ipcRenderer.invoke('llm:remove-engine', id),

  sendChat: (payload: { engine: any; messages: any[]; apiKey: string; tools?: any[] }) => ipcRenderer.invoke('llm:chat-proxy', payload),

  // 💡 [신규] 채팅 세션 및 메시지 관리
  getSessions: () => ipcRenderer.invoke('chat:get-sessions'),
  createSession: (session: { id: string; title: string; engineId: string }) => ipcRenderer.invoke('chat:create-session', session),
  deleteSession: (sessionId: string) => ipcRenderer.invoke('chat:delete-session', sessionId),
  getMessages: (sessionId: string) => ipcRenderer.invoke('chat:get-messages', sessionId),
  saveMessage: (message: { id: string; sessionId: string; role: string; content: string }) => ipcRenderer.invoke('chat:save-message', message),
  updateChatSessionTitle: (args: { sessionId: string; title: string }) => ipcRenderer.invoke('chat:update-session-title', args),
  getSummary: (sessionId: string) => ipcRenderer.invoke('summary:get', sessionId),
  saveSummary: (args: any) => ipcRenderer.invoke('summary:save', args),
  uploadLocalImage: (payload: { name: string; base64Data: string }) => ipcRenderer.invoke('chat:upload-local-image', payload),
  deleteSessionImages: (payload: { sessionId: string }) => ipcRenderer.invoke('chat:delete-session-images', payload),

  openFileDialog: () => ipcRenderer.invoke('mcp:open-file-dialog'),
  uploadPlugin: (payload: any) => ipcRenderer.invoke('mcp:upload-plugin', payload),


  // 원격 서버 플러그인의 실시간 활성화 상태 체크 (Online/Offline 스캔용)
  checkRemoteStatus: (payload: { url: string; apiKey: string }) => ipcRenderer.invoke('mcp:check-remote-status', payload),


  toggleMcpPlugin: (payload: { pluginId: string; enabled: boolean }) => ipcRenderer.invoke('mcp:toggle-plugin', payload),
});