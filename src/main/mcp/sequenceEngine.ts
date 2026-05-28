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

  constructor(
    db: Database,
    pluginManager: McpPluginManager,
    getOnlineStates: () => Record<string, boolean>
  ) {
    this.db = db;
    this.pluginManager = pluginManager;
    this.getOnlineStates = getOnlineStates;
  }

  // ✅ 윈도우 참조 세터
  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  // ✅ 렌더러로 이벤트 푸시하는 내부 헬퍼
  private emit(data: { sequenceId: string; status: 'running' | 'completed' | 'failed'; stepIndex: number | null; error?: string }) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('sequence:status', data);
    }
  }

  // ✅ Pre-flight: 시퀀스에 필요한 원격 플러그인 온라인 여부 사전 검증
  private async checkRemotePluginsReady(steps: any[]): Promise<void> {
    const requiredPluginIds = [
      ...new Set(
        steps
          .map((s: any) => s.pluginId)
          .filter((id: string) => id && id !== 'AI_Core')
      )
    ];

    for (const pluginId of requiredPluginIds) {
      const plugin = await this.db.get(
        "SELECT id, type, url, apiKey, name FROM mcp_plugins WHERE id = ?",
        [pluginId]
      );

      if (!plugin || plugin.type !== 'remote') continue;

      // 캐시된 상태 우선 확인
      const onlineStates = this.getOnlineStates();
      if (onlineStates[pluginId] === false) {
        throw new Error(
          `원격 플러그인 [${plugin.name}]이 오프라인 상태입니다. 서버 연결을 확인하세요.`
        );
      }

      // 캐시가 없으면 직접 헬스체크
      if (onlineStates[pluginId] === undefined) {
        try {
          await axios.get(`${plugin.url}/api/v1/tools`, {
            headers: { 'X-API-KEY': plugin.apiKey || '' },
            timeout: 2000
          });
        } catch {
          throw new Error(
            `원격 플러그인 [${plugin.name}]에 연결할 수 없습니다. 시퀀스 실행을 중단합니다.`
          );
        }
      }
    }
  }

  /**
   * 💡 1. 앱 기동 시 스케줄러 일제히 등록 및 백그라운드 상주 가동
   */
  async initializeSchedules(): Promise<void> {
    try {
      // 💡 [자원 선청소] 기존에 가동 중이던 모든 백그라운드 태스크 크론 링을 일제히 안전 종료합니다.
      if (this.scheduledTasks.size > 0) {
        for (const [seqId, task] of this.scheduledTasks.entries()) {
          task.stop();
        }
        this.scheduledTasks.clear();
      }

      // 🎯 [해결] 확실하게 명시적으로 활성화 스위치가 켜진(s.isEnabled = 1) 타겟만 가려옵니다.
      const activeSchedules = await this.db.all(
        `SELECT s.*, q.name FROM automation_schedules s 
         JOIN automation_sequences q ON s.sequenceId = q.id 
         WHERE s.isEnabled = 1`
      );

      for (const sched of activeSchedules) {
        this.registerCron(sched.sequenceId, sched.cronExpression);
      }
      console.log(`⏰ [Automation Engine] 실시간 동기화 완료: 활성화된 ${activeSchedules.length}개의 파이프라인 배치 가동 중`);
    } catch (e) {
      console.error("백그라운드 스케줄러 정비 실패:", e);
    }
  }

  private registerCron(sequenceId: string, cronExpression: string) {
    if (this.scheduledTasks.has(sequenceId)) {
      this.scheduledTasks.get(sequenceId)?.stop();
    }

    const task = cron.schedule(cronExpression, async () => {
      console.log(`⚡ [Trigger] 정각 주기 도달, 시퀀스 실행 개시: ${sequenceId}`);
      await this.executeSequence(sequenceId);
    });

    this.scheduledTasks.set(sequenceId, task);
  }

  /**
   * 💡 2. 파이프라인 시퀀스 연속 순차 트랜잭션 실행 코어 파트 (JIT 플러그인 자동 종료 방어 레이어 통합)
   */
  async executeSequence(sequenceId: string): Promise<void> {
    const steps = await this.db.all(
      'SELECT * FROM sequence_steps WHERE sequenceId = ? ORDER BY stepOrder ASC',
      [sequenceId]
    );
    const contextStorage: Record<string, any> = {};
    const jitBootedPluginIds: string[] = [];

    // ✅ 실행 전 원격 플러그인 상태 검증
    try {
      await this.checkRemotePluginsReady(steps);
    } catch (error: any) {
      this.emit({ sequenceId, status: 'failed', stepIndex: null, error: error.message });
      throw error;
    }

    // ✅ 시작 알림
    this.emit({ sequenceId, status: 'running', stepIndex: null });

    try {
      for (const step of steps) {
        // ✅ 각 스텝 진입 시 알림
        this.emit({ sequenceId, status: 'running', stepIndex: step.stepOrder });

        let rawArgsStr = step.argsTemplate;
        Object.keys(contextStorage).forEach((key) => {
          const rawValue = contextStorage[key];
          let safeValueStr = typeof rawValue === 'string'
            ? JSON.stringify(rawValue).slice(1, -1)
            : JSON.stringify(rawValue);
          const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          rawArgsStr = rawArgsStr.replace(new RegExp(`{{${escapedKey}}}`, 'g'), safeValueStr);
        });

        const parsedArgs = JSON.parse(rawArgsStr);
        
        if (step.fullToolName === 'ai__ask_llm') {
          console.log(`🤖 [AI Bridge] 시퀀스 중간 단계 LLM 추론 가동 개시...`);
          
          const activeEngine = await this.db.get('SELECT * FROM engines LIMIT 1');
          if (!activeEngine) {
            throw new Error("❌ 활성화된 코어 LLM 엔진 설정을 찾을 수 없어 AI 추론을 진행할 수 없습니다.");
          }

          const userPrompt = parsedArgs.prompt || '';
          const url = activeEngine.url;
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

          const targetUrl = activeEngine.provider === 'google' ? `${url}?key=${activeEngine.apiKey}` : url;

          const response = await fetch(targetUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
          });

          const rawData = await response.json();
          if (!response.ok) throw new Error(`AI 요청 통신 실패: ${JSON.stringify(rawData)}`);

          let aiReplyText = '';
          if (activeEngine.provider === 'openai') {
            aiReplyText = rawData.choices?.[0]?.message?.content || '';
          } else if (activeEngine.provider === 'anthropic') {
            aiReplyText = rawData.content?.[0]?.text || '';
          } else if (activeEngine.provider === 'google') {
            aiReplyText = rawData.candidates?.[0]?.content?.parts?.[0]?.text || '';
          }

          console.log(`🤖 [AI Bridge] LLM 추론 정제 완료 (사이즈: ${aiReplyText.length}자)`);
          
          contextStorage[`step_${step.stepOrder}.output`] = aiReplyText;
          continue;
        }

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
        contextStorage[`step_${step.stepOrder}.output`] = extractedOutput;
      }

      await this.db.run(
        'UPDATE automation_schedules SET lastRunTimestamp = ? WHERE sequenceId = ?',
        [Date.now(), sequenceId]
      ).catch(() => {});

      this.emit({ sequenceId, status: 'completed', stepIndex: null });

    } catch (error: any) {
      // ✅ 실패 알림
      this.emit({ sequenceId, status: 'failed', stepIndex: null, error: error.message });
      throw error;

    } finally {
      if (jitBootedPluginIds.length > 0) {
        for (const pluginId of jitBootedPluginIds) {
          await this.pluginManager.toggleSinglePlugin(pluginId, false).catch(() => {});
        }
      }
    }
  }
}