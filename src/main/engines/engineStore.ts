// src/main/engines/engineStore.ts
export interface EngineConfig {
  id: string;          // 예: 'claude-3-5', 'gpt-4o'
  name: string;        // 예: 'Claude 3.5 Sonnet'
  provider: 'anthropic' | 'openai' | 'google'; 
  url: string;         // API 요청 주소
  apiKey: string;      // 저장된 키
  model: string;       // 모델 명칭
}