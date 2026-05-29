// src/main/mcp/sequenceEngine.ts
import { BrowserWindow } from 'electron';
import { Database } from 'sqlite';
import { McpPluginManager } from './pluginManager';
import * as cron from 'node-cron';
import axios from 'axios';

export class McpSequenceEngine {
  private db: Database;
  private pluginManager: McpPluginManager;
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();
  private mainWindow: BrowserWindow | null = null;
  private getOnlineStates: () => Record<string, boolean>;

  constructor(db: Database, pluginManager: McpPluginManager, getOnlineStates: () => Record<string, boolean>) {
    this.db = db;
    this.pluginManager = pluginManager;
    this.getOnlineStates = getOnlineStates;
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  private emit(data: {
    sequenceId: string;
    status: 'running' | 'completed' | 'failed';
    stepIndex: number | null;
    error?: string;
  }) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('sequence:status', data);
    }
  }

  private async checkRemotePluginsReady(steps: any[]): Promise<void> {
    const requiredPluginIds = [
      ...new Set(steps.map((s: any) => s.pluginId).filter((id: string) => id && id !== 'AI_Core'))
    ];

    for (const pluginId of requiredPluginIds) {
      const plugin = await this.db.get(
        'SELECT id, type, url, apiKey, name FROM mcp_plugins WHERE id = ?', [pluginId]
      );
      if (!plugin || plugin.type !== 'remote') continue;

      const onlineStates = this.getOnlineStates();
      if (onlineStates[pluginId] === false) {
        throw new Error(`원격 플러그인 [${plugin.name}]이 오프라인 상태입니다.`);
      }
      if (onlineStates[pluginId] === undefined) {
        try {
          await axios.get(`${plugin.url}/api/v1/tools`, {
            headers: { 'X-API-KEY': plugin.apiKey || '' }, timeout: 2000
          });
        } catch {
          throw new Error(`원격 플러그인 [${plugin.name}]에 연결할 수 없습니다.`);
        }
      }
    }
  }

  async initializeSchedules(): Promise<void> {
    try {
      for (const [, task] of this.scheduledTasks.entries()) task.stop();
      this.scheduledTasks.clear();

      const activeSchedules = await this.db.all(
        `SELECT s.*, q.name FROM automation_schedules s 
         JOIN automation_sequences q ON s.sequenceId = q.id 
         WHERE s.isEnabled = 1`
      );

      for (const sched of activeSchedules) {
        this.registerCron(sched.sequenceId, sched.cronExpression);
      }
      console.log(`⏰ [Automation Engine] ${activeSchedules.length}개 파이프라인 배치 가동 중`);
    } catch (e) {
      console.error('백그라운드 스케줄러 정비 실패:', e);
    }
  }

  private registerCron(sequenceId: string, cronExpression: string) {
    if (this.scheduledTasks.has(sequenceId)) {
      this.scheduledTasks.get(sequenceId)?.stop();
    }
    const task = cron.schedule(cronExpression, async () => {
      console.log(`⚡ [Trigger] 시퀀스 실행: ${sequenceId}`);
      await this.executeSequence(sequenceId);
    });
    this.scheduledTasks.set(sequenceId, task);
  }

  async executeSequence(sequenceId: string): Promise<void> {
    // 1. 해당 시퀀스의 명세 데이터(정적 기본값 및 변수) 호출
    const sequenceMaster = await this.db.get(
      'SELECT * FROM automation_sequences WHERE id = ?', [sequenceId]
    );
    
    const steps = await this.db.all(
      'SELECT * FROM sequence_steps WHERE sequenceId = ? ORDER BY stepOrder ASC',
      [sequenceId]
    );

    // 💡 [인메모리 적재 1] 글로벌 변수 런타임 캐시 맵 빌드 
    const runtimeVariables: Record<string, any> = {};
    if (sequenceMaster && sequenceMaster.variables) {
      try {
        const parsedVars = JSON.parse(sequenceMaster.variables);
        if (Array.isArray(parsedVars)) {
          parsedVars.forEach((v: any) => {
            if (v && v.key) runtimeVariables[v.key] = v.value;
          });
        }
      } catch (e) {
        console.error('❌ 시퀀스 가변 변수 초기화 JSON 파싱 실패:', e);
      }
    }

    // 💡 [인메모리 적재 2] 스텝별 결과 보관 컨텍스트 저장소
    const contextStorage: Record<string, any> = {};
    const jitBootedPluginIds: string[] = [];
    let currentStepIndex: number | null = null;

    try {
      await this.checkRemotePluginsReady(steps);
    } catch (error: any) {
      this.emit({ sequenceId, status: 'failed', stepIndex: null, error: error.message });
      throw error;
    }

    this.emit({ sequenceId, status: 'running', stepIndex: null });

    try {
      for (const step of steps) {
        currentStepIndex = step.stepOrder;

        // 스텝 시작 알림 + 최소 표시 시간 보장
        this.emit({ sequenceId, status: 'running', stepIndex: step.stepOrder });
        await new Promise(resolve => setTimeout(resolve, 300));

        let rawArgsStr = step.argsTemplate;

        // 💡 [컴파일 가드 1] 글로벌 가변 변수 마커 전처리 치환 ({{variables.my_var}} 매핑)
        Object.keys(runtimeVariables).forEach((vKey) => {
          const vValue = runtimeVariables[vKey];
          const safeVarValueStr = typeof vValue === 'string'
            ? JSON.stringify(vValue).slice(1, -1)
            : JSON.stringify(vValue);
          const escapedVarKey = vKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          rawArgsStr = rawArgsStr.replace(new RegExp(`{{variables.${escapedVarKey}}}`, 'g'), safeVarValueStr);
        });

        // 💡 [컴파일 가드 2] 이전 단계 아웃풋 마커 전처리 치환 ({{step_X.output}} 매핑)
        Object.keys(contextStorage).forEach((key) => {
          const rawValue = contextStorage[key];
          const safeValueStr = typeof rawValue === 'string'
            ? JSON.stringify(rawValue).slice(1, -1)
            : JSON.stringify(rawValue);
          const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          rawArgsStr = rawArgsStr.replace(new RegExp(`{{${escapedKey}}}`, 'g'), safeValueStr);
        });

        const parsedArgs = JSON.parse(rawArgsStr);

        // 🎯 [대혁신 가상 분기 인터셉터] core__set_variable 변수 스토어 기능 작동 가드
        if (step.fullToolName === 'core__set_variable') {
          const targetKey = parsedArgs.target_variable;
          const valueToStore = parsedArgs.value_to_store ?? "";
          
          if (targetKey) {
            // 인메모리 가변 상태 풀 즉시 갱신 (정의되지 않은 임시 키라도 유연하게 주입 수용)
            runtimeVariables[targetKey] = valueToStore;
            console.log(`⚡ [Runtime Variable Set] 변수 [${targetKey}] 값 적재 성공:`, valueToStore);
          }
          
          // 가상 도구 노드이므로 결과 컨텍스트만 채우고 하위 인프라 연동을 무시한 채 스킵
          contextStorage[`step_${step.stepOrder}.output`] = valueToStore;
          continue;
        }

        // --- 프로바이더 가동: ai__ask_llm 내부 가상 처리 엔진 분기 ---
        if (step.fullToolName === 'ai__ask_llm') {
          console.log(`🤖 [AI Bridge] LLM 추론 가동...`);
          const activeEngine = await this.db.get('SELECT * FROM engines LIMIT 1');
          if (!activeEngine) throw new Error('활성화된 LLM 엔진을 찾을 수 없습니다.');

          const userPrompt = parsedArgs.prompt || '';
          let headers: any = { 'Content-Type': 'application/json' };
          let body: any = { model: activeEngine.model };

          if (activeEngine.provider === 'openai') {
            headers['Authorization'] = `Bearer ${activeEngine.apiKey}`;
            body.messages = [{ role: 'user', content: userPrompt }];
          } else if (activeEngine.provider === 'anthropic') {
            headers['x-api-key'] = activeEngine.apiKey;
            headers['anthropic-version'] = '2023-06-01';
            body.messages = [{ role: 'user', content: userPrompt }];
            body.max_tokens = 4096;
          } else if (activeEngine.provider === 'google') {
            body.contents = [{ role: 'user', parts: [{ text: userPrompt }] }];
          }

          const targetUrl = activeEngine.provider === 'google'
            ? `${activeEngine.url}?key=${activeEngine.apiKey}` : activeEngine.url;

          const response = await fetch(targetUrl, { method: 'POST', headers, body: JSON.stringify(body) });
          const rawData = await response.json();
          if (!response.ok) throw new Error(`AI 요청 실패: ${JSON.stringify(rawData)}`);

          let aiReplyText = '';
          if (activeEngine.provider === 'openai') aiReplyText = rawData.choices?.[0]?.message?.content || '';
          else if (activeEngine.provider === 'anthropic') aiReplyText = rawData.content?.[0]?.text || '';
          else if (activeEngine.provider === 'google') aiReplyText = rawData.candidates?.[0]?.content?.parts?.[0]?.text || '';

          // 런타임 결과 적재
          contextStorage[`step_${step.stepOrder}.output`] = aiReplyText;
          continue;
        }

        // --- 일반 실물 플러그인 도구 제어 라인 ---
        let pluginInstance = (this.pluginManager as any).plugins.get(step.pluginId);
        if (!pluginInstance) {
          await this.pluginManager.toggleSinglePlugin(step.pluginId, true);
          jitBootedPluginIds.push(step.pluginId);
          pluginInstance = (this.pluginManager as any).plugins.get(step.pluginId);
          if (!pluginInstance) throw new Error(`플러그인 런타임 복구 실패: ${step.pluginId}`);
        }

        const stepResult = await this.pluginManager.routeCallTool(step.fullToolName, parsedArgs);
        let extractedOutput = '';
        if (stepResult && Array.isArray(stepResult.content)) {
          extractedOutput = stepResult.content[0]?.text || JSON.stringify(stepResult);
        } else if (stepResult && typeof stepResult === 'object') {
          extractedOutput = JSON.stringify(stepResult);
        } else {
          extractedOutput = String(stepResult || '');
        }
        
        // 최종 데이터 인메모리 컨텍스트 적재 포워딩 처리
        contextStorage[`step_${step.stepOrder}.output`] = extractedOutput;
      }

      await this.db.run(
        'UPDATE automation_schedules SET lastRunTimestamp = ? WHERE sequenceId = ?',
        [Date.now(), sequenceId]
      ).catch(() => {});

      this.emit({ sequenceId, status: 'completed', stepIndex: null });

    } catch (error: any) {
      this.emit({ sequenceId, status: 'failed', stepIndex: currentStepIndex, error: error.message });
      throw error;

    } finally {
      for (const pluginId of jitBootedPluginIds) {
        await this.pluginManager.toggleSinglePlugin(pluginId, false).catch(() => {});
      }
    }
  }
}