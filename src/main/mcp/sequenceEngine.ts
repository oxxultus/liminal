// src/main/mcp/sequenceEngine.ts
import { BrowserWindow } from 'electron';
import { Database } from 'sqlite';
import { McpPluginManager } from './pluginManager';
import * as cron from 'node-cron';
import axios from 'axios';

type BranchState = 'NONE' | 'EXECUTING' | 'SKIPPING';

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
      console.log(`⚡ [Trigger] 스케줄러 자동 실행 트리거 가동: ${sequenceId}`);
      await this.executeSequence(sequenceId);
    });
    this.scheduledTasks.set(sequenceId, task);
  }

  async executeSequence(sequenceId: string): Promise<void> {
    const sequenceMaster = await this.db.get(
      'SELECT * FROM automation_sequences WHERE id = ?', [sequenceId]
    );
    
    const steps = await this.db.all(
      'SELECT * FROM sequence_steps WHERE sequenceId = ? ORDER BY stepOrder ASC',
      [sequenceId]
    );

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

    const contextStorage: Record<string, any> = {};
    const jitBootedPluginIds: string[] = [];
    let currentStepIndex: number | null = null;

    // 💡 [지능형 다중 분기 제어 상태 머신 변수]
    let currentBranchState: BranchState = 'NONE';
    let hasAnyBranchExecuted = false; // 현재 If-Else 체인 세트 안에서 참이 발생해 실행된 적이 있는지 여부

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

        // 💡 [컴파일 가드 1] core__end_if 노드를 만나면 분기 인터페이스 컨텍스트 전체 초기화 및 흐름 완전 결합
        if (step.fullToolName === 'core__end_if') {
          console.log(`➡️ [Conditional] 분기 세트 종결 블록 도달. 제어 필터 전체 해제.`);
          currentBranchState = 'NONE';
          hasAnyBranchExecuted = false;
          contextStorage[`step_${step.stepOrder}.output`] = "Chain Block Closed";
          continue;
        }

        // 💡 [컴파일 가드 2] 스킵 상태이거나, 다른 블록이 구동 중일 때 일반 노드 순수 스킵 처리
        if (currentBranchState === 'SKIPPING' && step.fullToolName !== 'core__else_if') {
          console.log(`⏩ [Conditional Skip] 조건 불충족 분기 구간: [${step.fullToolName}] 실행을 건너뜁니다.`);
          contextStorage[`step_${step.stepOrder}.output`] = "Skipped by condition branch";
          continue;
        }

        let rawArgsStr = step.argsTemplate;

        // 마커 치환 (Variables / Node Outputs)
        Object.keys(runtimeVariables).forEach((vKey) => {
          const vValue = runtimeVariables[vKey];
          const safeVarValueStr = typeof vValue === 'string' ? JSON.stringify(vValue).slice(1, -1) : JSON.stringify(vValue);
          rawArgsStr = rawArgsStr.replace(new RegExp(`{{variables.${vKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}}}`, 'g'), safeVarValueStr);
        });

        Object.keys(contextStorage).forEach((key) => {
          const rawValue = contextStorage[key];
          const safeValueStr = typeof rawValue === 'string' ? JSON.stringify(rawValue).slice(1, -1) : JSON.stringify(rawValue);
          rawArgsStr = rawArgsStr.replace(new RegExp(`{{${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}}}`, 'g'), safeValueStr);
        });

        // 빈 템플릿 처리 방어
        let parsedArgs: Record<string, any> = {};
        if (rawArgsStr && rawArgsStr.trim() !== '{}' && rawArgsStr.trim() !== '') {
          try { parsedArgs = JSON.parse(rawArgsStr); } catch { parsedArgs = {}; }
        }

        // 🎯 [핵심 오케스트레이션 1] core__if_condition (최초 분기점 시작)
        if (step.fullToolName === 'core__if_condition') {
          this.emit({ sequenceId, status: 'running', stepIndex: step.stepOrder });
          
          const rawLeft = String(parsedArgs.left_value ?? '').trim();
          const operator = parsedArgs.operator || 'equals';
          const rawRight = String(parsedArgs.right_value ?? '').trim();

          const isNumeric = ['greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal'].includes(operator);
          let leftValue: any = rawLeft;
          let rightValue: any = rawRight;

          if (isNumeric) {
            const leftMatch = rawLeft.match(/-?\d+(\.\d+)?/);
            const rightMatch = rawRight.match(/-?\d+(\.\d+)?/);
            leftValue = leftMatch ? Number(leftMatch[0]) : Number(rawLeft);
            rightValue = rightMatch ? Number(rightMatch[0]) : Number(rawRight);
          }

          let conditionPassed = false;
          if (operator === 'equals') conditionPassed = String(rawLeft) === String(rawRight);
          else if (operator === 'not_equals') conditionPassed = String(rawLeft) !== String(rawRight);
          else if (operator === 'contains') conditionPassed = String(rawLeft).includes(String(rawRight));
          else if (operator === 'not_contains') conditionPassed = !String(rawLeft).includes(String(rawRight));
          else if (!isNaN(leftValue) && !isNaN(rightValue)) {
            if (operator === 'greater_than') conditionPassed = leftValue > rightValue;
            else if (operator === 'less_than') conditionPassed = leftValue < rightValue;
            else if (operator === 'greater_than_or_equal') conditionPassed = leftValue >= rightValue;
            else if (operator === 'less_than_or_equal') conditionPassed = leftValue <= rightValue;
          }

          console.log(`🔍 [IF 조건 검사] Left: ${leftValue} | Op: ${operator} | Right: ${rightValue} => 결과: ${conditionPassed}`);

          if (conditionPassed) {
            currentBranchState = 'EXECUTING';
            hasAnyBranchExecuted = true;
          } else {
            currentBranchState = 'SKIPPING';
            hasAnyBranchExecuted = false;
          }

          contextStorage[`step_${step.stepOrder}.output`] = conditionPassed ? "IF True" : "IF False";
          continue;
        }

        // 🎯 [핵심 오케스트레이션 2] core__else_if (연달아 배치되는 다중 분기 가드 인터셉터)
        if (step.fullToolName === 'core__else_if') {
          this.emit({ sequenceId, status: 'running', stepIndex: step.stepOrder });

          // 💡 이미 앞 단계(IF 또는 다른 ELSE IF)에서 충족되어 실행된 적이 있다면 구문 분석 없이 무조건 강제 패스!
          if (hasAnyBranchExecuted) {
            console.log(`⏩ [Else If Bypass] 이미 상위 분기 조건이 만족되어 정밀 분석 없이 패스(SKIPPING) 처리합니다.`);
            currentBranchState = 'SKIPPING';
            contextStorage[`step_${step.stepOrder}.output`] = "Else If Skipped (Already executed matching chain)";
            continue;
          }

          // 앞의 조건이 다 틀려서 기회가 도래한 경우 비로소 내 조건식 평가 개시
          const rawLeft = String(parsedArgs.left_value ?? '').trim();
          const operator = parsedArgs.operator || 'equals';
          const rawRight = String(parsedArgs.right_value ?? '').trim();

          const isNumeric = ['greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal'].includes(operator);
          let leftValue: any = rawLeft;
          let rightValue: any = rawRight;

          if (isNumeric) {
            const leftMatch = rawLeft.match(/-?\d+(\.\d+)?/);
            const rightMatch = rawRight.match(/-?\d+(\.\d+)?/);
            leftValue = leftMatch ? Number(leftMatch[0]) : Number(rawLeft);
            rightValue = rightMatch ? Number(rightMatch[0]) : Number(rawRight);
          }

          let conditionPassed = false;
          if (operator === 'equals') conditionPassed = String(rawLeft) === String(rawRight);
          else if (operator === 'not_equals') conditionPassed = String(rawLeft) !== String(rawRight);
          else if (operator === 'contains') conditionPassed = String(rawLeft).includes(String(rawRight));
          else if (operator === 'not_contains') conditionPassed = !String(rawLeft).includes(String(rawRight));
          else if (!isNaN(leftValue) && !isNaN(rightValue)) {
            if (operator === 'greater_than') conditionPassed = leftValue > rightValue;
            else if (operator === 'less_than') conditionPassed = leftValue < rightValue;
            else if (operator === 'greater_than_or_equal') conditionPassed = leftValue >= rightValue;
            else if (operator === 'less_than_or_equal') conditionPassed = leftValue <= rightValue;
          }

          console.log(`🔍 [ELSE IF 조건 검사] Left: ${leftValue} | Op: ${operator} | Right: ${rightValue} => 결과: ${conditionPassed}`);

          if (conditionPassed) {
            currentBranchState = 'EXECUTING';
            hasAnyBranchExecuted = true;
          } else {
            currentBranchState = 'SKIPPING';
          }

          contextStorage[`step_${step.stepOrder}.output`] = conditionPassed ? "Else If True" : "Else If False";
          continue;
        }

        this.emit({ sequenceId, status: 'running', stepIndex: step.stepOrder });
        await new Promise(resolve => setTimeout(resolve, 250));

        // core__set_variable 가상 플러그인 제어
        if (step.fullToolName === 'core__set_variable') {
          const targetKey = parsedArgs.target_variable;
          const valueToStore = parsedArgs.value_to_store ?? "";
          if (targetKey) { runtimeVariables[targetKey] = valueToStore; }
          contextStorage[`step_${step.stepOrder}.output`] = valueToStore;
          continue;
        }

        // ai__ask_llm 가상 처리 엔진
        if (step.fullToolName === 'ai__ask_llm') {
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
            body.max_tokens = 2048;
          } else if (activeEngine.provider === 'google') {
            body.contents = [{ role: 'user', parts: [{ text: userPrompt }] }];
          }

          const targetUrl = activeEngine.provider === 'google' ? `${activeEngine.url}?key=${activeEngine.apiKey}` : activeEngine.url;
          const response = await fetch(targetUrl, { method: 'POST', headers, body: JSON.stringify(body) });
          const rawData = await response.json();
          if (!response.ok) throw new Error(`AI 요청 실패: ${JSON.stringify(rawData)}`);

          let aiReplyText = '';
          if (activeEngine.provider === 'openai') aiReplyText = rawData.choices?.[0]?.message?.content || '';
          else if (activeEngine.provider === 'anthropic') aiReplyText = rawData.content?.[0]?.text || '';
          else if (activeEngine.provider === 'google') aiReplyText = rawData.candidates?.[0]?.content?.parts?.[0]?.text || '';

          contextStorage[`step_${step.stepOrder}.output`] = aiReplyText;
          continue;
        }

        // 일반 실물 플러그인 도구 제어 라인
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
      this.emit({ sequenceId, status: 'failed', stepIndex: currentStepIndex, error: error.message });
      throw error;
    } finally {
      for (const pluginId of jitBootedPluginIds) {
        await this.pluginManager.toggleSinglePlugin(pluginId, false).catch(() => {});
      }
    }
  }
}