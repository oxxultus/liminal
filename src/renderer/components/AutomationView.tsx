// src/renderer/components/AutomationView.tsx
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, Reorder } from 'framer-motion';

interface McpTool {
  name: string;
  description: string;
  input_schema: any;
  pluginId: string;
}

interface SelectedStep {
  id: string;
  fullToolName: string;
  argsTemplate: string;
  pluginId: string;
}

interface SequenceVariable {
  key: string;
  value: string;
}

interface SavedSequence {
  id: string;
  name: string;
  description: string;
  cronExpression: string;
  isEnabled: boolean; 
  lastRunTimestamp: number | null;
  steps?: SelectedStep[]; 
  variables?: SequenceVariable[]; 
}

const Icon = {
  Plus: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Trash: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  Play: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  Close: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Clock: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  ArrowDown: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  ArrowUp: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>,
  FlowDown: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>,
  Empty: () => <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>,
  Gear: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Pin: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.12-2.58A2 2 0 0 1 16 10.18V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v5.18a2 2 0 0 1-.44 1.24L5.44 14a2 2 0 0 0-.44 1.24z"/></svg>,
  Lightbulb: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5.5 5.5 0 0 0 12.5 2.5a5.5 5.5 0 0 0-5.5 5.5c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>,
  Target: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  Cpu: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" style={{ marginRight: '6px', flexShrink: 0 }}><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="24"/><line x1="15" y1="20" x2="15" y2="24"/><line x1="20" y1="9" x2="24" y2="9"/><line x1="20" y1="15" x2="24" y2="15"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="15" x2="4" y2="15"/></svg>,
  AlertCircleRed: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>, 
  AlertCircleBlue: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>, 
  More: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>,
  Edit: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z"/></svg>,
  Activity: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  Network: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M12 8v8M5 16v-3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/></svg>,
  CheckCircle: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  Variable: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4h16v3M9 20h6M12 4v16"/></svg>,
  Link: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  Flash: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
};

export default function AutomationView() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAllVarsPopupOpen, setIsAllVarsPopupOpen] = useState(false); 
  const [isHelpOpen, setIsHelpOpen] = useState(false); 
  const [savedSequences, setSavedSequences] = useState<SavedSequence[]>([]);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const [failedSequenceIds, setFailedSequenceIds] = useState<Set<string>>(new Set());
  
  const [plugins, setPlugins] = useState<any[]>([]);
  const [availableTools, setAvailableTools] = useState<McpTool[]>([]);
  const [activePluginFilter, setActivePluginFilter] = useState('all');
  
  // 에디터 제어 훅
  const [editingSequenceId, setEditingSequenceId] = useState<string | null>(null);
  const [sequenceName, setSequenceName] = useState('');
  const [sequenceDesc, setSequenceDesc] = useState('');
  const [cronExpr, setCronExpr] = useState('0 3 * * *'); 
  const [steps, setSteps] = useState<SelectedStep[]>([]);
  const [variables, setVariables] = useState<SequenceVariable[]>([]); 
  const [draggingTool, setDraggingTool] = useState<McpTool | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [failedStepIndex, setFailedStepIndex] = useState<number | null>(null);
  const [failedError, setFailedError] = useState<string | null>(null);
  const [tooltipStepId, setTooltipStepId] = useState<string | null>(null);

  const [collapsedSteps, setCollapsedSteps] = useState<Set<string>>(new Set());
  const [rawJsonModeSteps, setRawJsonModeSteps] = useState<Set<string>>(new Set()); 
  const [isVarsCollapsed, setIsVarsCollapsed] = useState(false); 

  // 필드별 칩 팝업 레이어 오픈 상태 관리
  const [activeChipMenuId, setActiveChipMenuId] = useState<string | null>(null);

  // 인풋창 임시 변수명 풀
  const [editingVarKeyIdx, setEditingVarKeyIdx] = useState<number | null>(null);
  const [editingVarKeyVal, setEditingVarKeyVal] = useState<string>('');

  // 실시간 관제 및 네이티브 컨펌 대체 브릿지 훅
  const [runningSequenceId, setRunningSequenceId] = useState<string | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const [confirmModalTarget, setConfirmModalTarget] = useState<SavedSequence | null>(null);
  const [deleteModalTarget, setDeleteModalTarget] = useState<SavedSequence | null>(null);

  const [completedSequenceIds, setCompletedSequenceIds] = useState<Set<string>>(new Set());

  const menuOpenSeqIdRef = useRef<string | null>(null);
  const [menuOpenSeqId, setMenuOpenSeqIdState] = useState<string | null>(null);
  const setMenuOpenSeqId = (id: string | null) => {
    menuOpenSeqIdRef.current = id;
    setMenuOpenSeqIdState(id);
  };
  const menuRef = useRef<HTMLDivElement>(null);
  const chipMenuRef = useRef<HTMLDivElement>(null);

  const fetchAutomationData = async () => {
    const list = await window.electronAPI.getMcpPluginsList().catch(() => []);
    setPlugins(list.filter((p: any) => p.enabled));

    const tools = await window.electronAPI.getMcpTools().catch(() => []);
    const mappedTools = tools.map((t: any) => {
      const pluginId = t.name && t.name.includes('__') ? t.name.split('__')[0] : 'unknown';
      return { 
        name: t.name,
        description: t.description || '',
        input_schema: t.input_schema || t.inputSchema || { type: 'object', properties: {} },
        pluginId 
      };
    });

    const aiVirtualTool: McpTool = {
      name: 'ai__ask_llm',
      description: '이전 단계의 수집 결과 데이터를 연동 프롬프트와 정밀 결합하여 AI에게 가공, 분석, 요약을 수급합니다.',
      input_schema: { type: 'object', properties: { prompt: { type: 'string' } } },
      pluginId: 'AI_Core'
    };

    const variableSetTool: McpTool = {
      name: 'core__set_variable',
      description: '이전 노드의 반환 데이터나 특정 텍스트를 글로벌 변수(Variables)에 강제 대입하여 바인딩 캐시를 업데이트합니다.',
      input_schema: { 
        type: 'object', 
        properties: { 
          target_variable: { type: 'string', description: '값을 저장할 대상 전역 변수 이름' },
          value_to_store: { type: 'string', description: '변수에 주입할 데이터 또는 마커 마킹' }
        } 
      },
      pluginId: 'AI_Core'
    };

    // 💡 [다중 조건 분기 추가] 최초 대문절 If 가상 노드
    const conditionIfTool: McpTool = {
      name: 'core__if_condition',
      description: '이전 단계의 반환 데이터나 변수 값을 비교 분석하여 조건이 참(True)일 때만 하위 블록 노드들을 통과시킵니다.',
      input_schema: {
        type: 'object',
        properties: {
          left_value: { type: 'string', description: '비교할 대상 값 (예: {{step_0.output}} 또는 {{variables.status}})' },
          operator: { type: 'string', description: '연산 규격 (equals, contains, greater_than 등)' },
          right_value: { type: 'string', description: '비교 기준 값' }
        }
      },
      pluginId: 'AI_Core'
    };

    // 💡 [다중 조건 분기 추가] Else If 가상 노드
    const conditionElseIfTool: McpTool = {
      name: 'core__else_if',
      description: '앞선 조건들이 거짓(False)이고 현재 설정한 조건이 참(True)인 경우에만 하위 블록 노드들을 가동합니다.',
      input_schema: {
        type: 'object',
        properties: {
          left_value: { type: 'string', description: '비교할 대상 값' },
          operator: { type: 'string', description: '연산 규격' },
          right_value: { type: 'string', description: '비교 기준 값' }
        }
      },
      pluginId: 'AI_Core'
    };

    // 💡 [다중 조건 분기 추가] End If 최종 블록 종결자 가상 노드
    const conditionEndIfTool: McpTool = {
      name: 'core__end_if',
      description: '열려 있는 조건 제어(If / Else If) 다중 분기 블록 영역을 닫고, 파이프라인의 일반 흐름을 다시 병합 재개시킵니다.',
      input_schema: { type: 'object', properties: {} },
      pluginId: 'AI_Core'
    };

    setAvailableTools([aiVirtualTool, variableSetTool, conditionIfTool, conditionElseIfTool, conditionEndIfTool, ...mappedTools]);

    if (window.electronAPI.getAutomationSequences) {
      const savedList = await window.electronAPI.getAutomationSequences().catch(() => []);
      setSavedSequences(savedList);
    }
  };

  useEffect(() => {
    fetchAutomationData();

    if (window.electronAPI.onSequenceStatus) {
      window.electronAPI.onSequenceStatus((data: {
        sequenceId: string;
        status: 'running' | 'completed' | 'failed';
        stepIndex: number | null;
        error?: string;
      }) => {
        if (data.status === 'running') {
          setRunningSequenceId(data.sequenceId);
          if (data.stepIndex !== null) setActiveStepIndex(data.stepIndex);

        } else if (data.status === 'completed') {
          setRunningSequenceId(null);
          setActiveStepIndex(null);
          setFailedStepIndex(null);
          setFailedError(null); 
          
          setFailedSequenceIds(prev => { const s = new Set(prev); s.delete(data.sequenceId); return s; });
          setCompletedSequenceIds(prev => new Set([...prev, data.sequenceId]));
          
          setTimeout(() => {
            setCompletedSequenceIds(prev => { const s = new Set(prev); s.delete(data.sequenceId); return s; });
          }, 2000);

          fetchAutomationData();
          setToastMessage(`🎯 파이프라인이 전 과정 무결하게 처리 완료되었습니다.`);
          setTimeout(() => setToastMessage(null), 3000);

        } else if (data.status === 'failed') {
          setRunningSequenceId(null);
          setActiveStepIndex(null);
          setFailedStepIndex(data.stepIndex ?? null);
          setFailedError(data.error ?? null);
          setFailedSequenceIds(prev => new Set([...prev, data.sequenceId]));
          fetchAutomationData();
          setToastMessage(`❌ [런타임 크래시] ${data.error}`);
          setTimeout(() => setToastMessage(null), 4000);
        }
      });
    }

    const handleOutsideClick = (e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          setMenuOpenSeqId(null);
        }
        if (chipMenuRef.current && !chipMenuRef.current.contains(e.target as Node)) {
          setActiveChipMenuId(null);
        }
    };
    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
        document.removeEventListener('mousedown', handleOutsideClick);
        window.electronAPI.offSequenceStatus?.();
    };
  }, [editingVarKeyIdx, editingVarKeyVal, variables]);

  const filteredTools = activePluginFilter === 'all' 
    ? availableTools 
    : availableTools.filter(t => t.pluginId === activePluginFilter);

  const handleDropOnBoard = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggingTool) return;

    let defaultSchema = "";
    if (draggingTool.name === 'ai__ask_llm') {
      defaultSchema = '{\n  "prompt": "여기에 프롬프트를 입력하세요.\\n\\n변수 연동: {{variables.my_var}}\\n이전 데이터: {{step_0.output}}"\n}';
    } else if (draggingTool.name === 'core__set_variable') {
      defaultSchema = '{\n  "target_variable": "",\n  "value_to_store": "{{step_0.output}}"\n}';
    } else if (draggingTool.name === 'core__if_condition' || draggingTool.name === 'core__else_if') {
      defaultSchema = '{\n  "left_value": "",\n  "operator": "equals",\n  "right_value": ""\n}';
    } else if (draggingTool.name === 'core__end_if') {
      defaultSchema = '{}';
    } else {
      defaultSchema = JSON.stringify(Object.keys(draggingTool.input_schema.properties || {}).reduce((acc: any, key) => { acc[key] = ""; return acc; }, {}), null, 2);
    }

    const newStep: SelectedStep = {
      id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      fullToolName: draggingTool.name,
      argsTemplate: defaultSchema,
      pluginId: draggingTool.pluginId
    };

    setSteps(prev => [...prev, newStep]);
    setDraggingTool(null);
  };

  const handleRemoveStep = (id: string) => { setSteps(steps.filter(s => s.id !== id)); };
  const handleStepArgsChange = (id: string, newValue: string) => { setSteps(steps.map(s => s.id === id ? { ...s, argsTemplate: newValue } : s)); };

  const toggleStepCollapse = (id: string) => {
    setCollapsedSteps(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleRawJsonMode = (id: string) => {
    setRawJsonModeSteps(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddVariable = () => {
    let index = 1;
    let proposedKey = `variable_${index}`;
    while (variables.some(v => v.key === proposedKey)) {
      index++;
      proposedKey = `variable_${index}`;
    }
    setVariables(prev => [...prev, { key: proposedKey, value: '' }]);
  };

  const handleCommitVariableKey = (index: number) => {
    if (editingVarKeyIdx !== index) return;
    
    const cleanKey = editingVarKeyVal.replace(/\s+/g, '');
    if (!cleanKey) {
      setEditingVarKeyIdx(null);
      return;
    }

    const isDuplicate = variables.some((v, i) => i !== index && v.key === cleanKey);
    if (isDuplicate) {
      setToastMessage(`⚠️ 중복된 변수명 [${cleanKey}]은 지정할 수 없습니다.`);
      setTimeout(() => setToastMessage(null), 3000);
      setEditingVarKeyIdx(null);
      return;
    }

    setVariables(prev => prev.map((v, i) => i === index ? { ...v, key: cleanKey } : v));
    setEditingVarKeyIdx(null);
  };

  const handleUpdateVariable = (index: number, field: 'key' | 'value', value: string) => {
    if (field === 'key') {
      setEditingVarKeyVal(value.replace(/\s+/g, ''));
      setEditingVarKeyIdx(index);
    } else {
      setVariables(prev => prev.map((v, i) => i === index ? { ...v, value } : v));
    }
  };

  const handleRemoveVariable = (index: number) => {
    setVariables(prev => prev.filter((_, i) => i !== index));
  };

  const handleStructuredFieldChange = (stepId: string, currentTemplate: string, fieldKey: string, fieldValue: string, isAppend = false) => {
    let currentObj: Record<string, any> = {};
    try {
      currentObj = JSON.parse(currentTemplate);
    } catch (e) {
      currentObj = {};
    }

    if (isAppend) {
      const oldVal = currentObj[fieldKey] ? String(currentObj[fieldKey]) : "";
      currentObj[fieldKey] = oldVal ? `${oldVal} ${fieldValue}` : fieldValue;
    } else {
      currentObj[fieldKey] = fieldValue;
    }

    handleStepArgsChange(stepId, JSON.stringify(currentObj, null, 2));
  };

  const handleToggleSequenceEnable = async (seq: SavedSequence) => {
    if (completedSequenceIds.has(seq.id) || runningSequenceId === seq.id) return;

    const nextStatus = !seq.isEnabled;
    setFailedSequenceIds(prev => { const s = new Set(prev); s.delete(seq.id); return s; });
    setSavedSequences(prev => prev.map(s => s.id === seq.id ? { ...s, isEnabled: nextStatus } : s));

    if (!window.electronAPI.toggleSequenceStatus) return;

    const res = await window.electronAPI.toggleSequenceStatus({
        sequenceId: seq.id,
        isEnabled: nextStatus
    });

    if (res && res.success) {
        await fetchAutomationData();
    } else {
        setSavedSequences(prev => prev.map(s => s.id === seq.id ? { ...s, isEnabled: seq.isEnabled } : s));
        setToastMessage(`❌ 상태 업데이트 실패: ${res?.error}`);
        setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const handleInspectSequenceGraph = (seq: SavedSequence) => {
    setEditingSequenceId(seq.id);
    setSequenceName(seq.name);
    setSequenceDesc(seq.description);
    setCronExpr(seq.cronExpression || '0 3 * * *'); 
    setSteps(seq.steps || []); 
    setVariables(seq.variables || []); 
    setIsModalOpen(true);
    setMenuOpenSeqId(null);
  };

  const handleOpenMenu = (e: React.MouseEvent, seqId: string) => {
    e.stopPropagation();
    setMenuOpenSeqId(menuOpenSeqId === seqId ? null : seqId);
  };

  const handleTriggerConfirmModal = (seq: SavedSequence) => {
    if (runningSequenceId !== null || completedSequenceIds.has(seq.id)) {
      setToastMessage('⚠️ 가동 중이거나 완료 공정 락이 걸린 파이프라인이 존재합니다.');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    if (!seq.isEnabled) {
      setToastMessage('비활성화된 시퀀스는 즉시 가동할 수 없습니다.');
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }
    setConfirmModalTarget(seq);
  };

  const handleExecuteNowWithTracking = async () => {
    if (!confirmModalTarget) return;
    const seq = confirmModalTarget;
    setConfirmModalTarget(null);

    setFailedSequenceIds(prev => { const s = new Set(prev); s.delete(seq.id); return s; });
    setRunningSequenceId(seq.id);
    setActiveStepIndex(null); 
    handleInspectSequenceGraph(seq);

    if (window.electronAPI.triggerSequenceNow) {
      const res = await window.electronAPI.triggerSequenceNow(seq.id);
      if (!res || !res.success) {
        setRunningSequenceId(null);
        setActiveStepIndex(null);
        setFailedSequenceIds(prev => new Set([...prev, seq.id]));
        setToastMessage(`❌ 가동 실패: ${res?.error}`);
        setTimeout(() => setToastMessage(null), 4000);
      }
      await fetchAutomationData();
    }
  };

  const handleTriggerDeleteModal = (seq: SavedSequence) => {
    if (runningSequenceId === seq.id || completedSequenceIds.has(seq.id)) return;
    setDeleteModalTarget(seq);
    setMenuOpenSeqId(null);
  };

  const handleRemoveSequence = async () => {
    if (!deleteModalTarget) return;
    const seq = deleteModalTarget;
    setDeleteModalTarget(null);

    if (window.electronAPI.deleteAutomationSequence) {
      await window.electronAPI.deleteAutomationSequence(seq.id);
      fetchAutomationData();
      setToastMessage(`🗑️ [${seq.name}] 파이프라인이 영구 소거되었습니다.`);
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const closeModal = () => {
    setEditingSequenceId(null); 
    setSequenceName(''); 
    setSequenceDesc(''); 
    setSteps([]);
    setVariables([]);
    setCollapsedSteps(new Set());
    setRawJsonModeSteps(new Set());
    setIsVarsCollapsed(false);
    setActiveChipMenuId(null);
    setEditingVarKeyIdx(null);
    setIsModalOpen(false);
  };

  const handleSaveAutomationPipeline = async () => {
    if (!sequenceName.trim() || steps.length === 0) {
      setStatusMsg('❌ 시퀀스 명칭과 최소 1개 이상의 스텝이 필요합니다.');
      setToastMessage('❌ 시퀀스 명칭과 최소 1개 이상의 스텝이 필요합니다.');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    const formattedSteps = steps.map((step, idx) => {
      const targetPluginConfig = plugins.find(p => p.id === step.pluginId);
      return {
        stepOrder: idx,
        fullToolName: step.fullToolName,
        argsTemplate: step.argsTemplate,
        pluginId: step.pluginId,
        pluginType: targetPluginConfig?.type || 'custom',
        pluginUrl: targetPluginConfig?.url || null,
        pluginApiKey: targetPluginConfig?.apiKey || null,
        pluginWorkspaceDir: targetPluginConfig?.workspaceDir || null
      };
    });

    const payload = {
      id: editingSequenceId || `seq-${Date.now()}`, 
      name: sequenceName.trim(),
      description: sequenceDesc.trim(),
      cronExpression: cronExpr.trim(),
      isEnabled: true, 
      steps: formattedSteps,
      variables 
    };

    if (window.electronAPI.saveAutomationSequence) {
      const res = await window.electronAPI.saveAutomationSequence(payload);
      if (res && res.success) {
        setToastMessage('🎯 자동화 명세가 마스터 스케줄러에 영구 동기화 완료되었습니다!');
        setTimeout(() => setToastMessage(null), 3000);
        closeModal(); fetchAutomationData();
      }
    }
  };

  const baseBadgeStyle: React.CSSProperties = {
    fontSize: '0.65rem',
    padding: '2px 6px',
    borderRadius: '5px',
    fontWeight: 800,
    textTransform: 'uppercase',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: '1',
    height: '18px',
    boxSizing: 'border-box',
    letterSpacing: '0.02em',
    color: '#fff'
  };

  const sharedChipBtnStyle = (bgColor: string, color: string): React.CSSProperties => ({
    border: 'none',
    background: bgColor,
    color: color,
    fontSize: '0.65rem',
    padding: '2px 6px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 600,
    display: 'inline-flex',
    alignItems: 'center',
    height: '18px',
    lineHeight: '1',
    boxSizing: 'border-box'
  });

  const [statusMsg, setStatusMsg] = useState('');

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', boxSizing: 'border-box', color: 'var(--color-text-main)' }}>
      <style>{`
        @keyframes mcp-network-pulse {
          0% { transform: scale(0.95); opacity: 0.5; box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.6); }
          50% { transform: scale(1.05); opacity: 1; box-shadow: 0 0 8px 2px rgba(59, 130, 246, 0.4); }
          100% { transform: scale(0.95); opacity: 0.5; box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        }
        @keyframes pulse-green {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6); }
          70% { transform: scale(1.05); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        @keyframes pulse-emerald {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6); }
          50% { transform: scale(1.03); box-shadow: 0 0 8px 2px rgba(16, 185, 129, 0.4); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        .pulse-active-dot { animation: pulse-green 1.4s infinite cubic-bezier(0.4, 0, 0.6, 1); }
        .pulse-running-badge { animation: mcp-network-pulse 1.5s infinite; }
        .pulse-completed-badge { animation: pulse-emerald 1.2s infinite; }
      `}</style>
      
      {/* 플로팅 헬프 토스트 */}
      <AnimatePresence>
        {toastMessage && typeof document !== 'undefined' && createPortal(
          <motion.div initial={{ opacity: 0, y: -20, x: 20 }} animate={{ opacity: 1, y: 0, x: 0 }} exit={{ opacity: 0, y: -10 }} style={{ position: 'fixed', top: '20px', right: '20px', width: '320px', background: 'rgba(30, 30, 38, 0.95)', border: '1px solid rgba(59, 130, 246, 0.4)', borderRadius: '12px', padding: '14px', boxShadow: '0 12px 30px rgba(0,0,0,0.25)', color: '#FFFFFF', fontSize: '0.8rem', zIndex: 11000, backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <Icon.AlertCircleBlue />
            <div>{toastMessage}</div>
          </motion.div>,
          document.body
        )}
      </AnimatePresence>

      {/* 실행 제어 전용 커스텀 컨펌 팝업 */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {confirmModalTarget && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(15px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100005 }} onClick={() => setConfirmModalTarget(null)}>
              <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }} onClick={e => e.stopPropagation()} style={{ width: '360px', padding: '24px', borderRadius: '18px', background: 'var(--bg-modal)', border: 'var(--border-glass)', boxShadow: '0 25px 60px rgba(0, 0, 0, 0.3)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}><Icon.Activity /> 시퀀스 실행 가동</div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '6px 0 0 0', lineHeight: '1.45' }}>
                    [<span style={{ color: '#2563eb', fontWeight: 700 }}>{confirmModalTarget.name}</span>] 자동화 파이프라인 그래프 시퀀스를 지금 즉시 가동하고 실시간 추적 관제 룸을 활성화하시겠습니까?
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button onClick={() => setConfirmModalTarget(null)} style={{ padding: '8px 14px', border: 'none', background: 'rgba(128,128,128,0.1)', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-muted)', cursor: 'pointer' }}>취소</button>
                  <button onClick={handleExecuteNowWithTracking} style={{ padding: '8px 16px', border: 'none', background: 'var(--color-text-main)', color: 'var(--color-btn-text)', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>즉시 가동</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* 소거 삭제 전용 커스텀 컨펌 팝업 */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {deleteModalTarget && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(15px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100005 }} onClick={() => setDeleteModalTarget(null)}>
              <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }} onClick={e => e.stopPropagation()} style={{ width: '360px', padding: '24px', borderRadius: '18px', background: 'var(--bg-modal)', border: 'var(--border-glass)', boxShadow: '0 25px 60px rgba(239, 68, 68, 0.15)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px' }}><Icon.Trash /> 파이프라인 영구 삭제</div>
                  <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '6px 0 0 0', lineHeight: '1.45' }}>
                    [<span style={{ fontWeight: 700, color: 'var(--color-text-main)' }}>{deleteModalTarget.name}</span>] 자동화 워크플로우 명세를 영구 소거하시겠습니까? 삭제 후에는 마스터 스케줄러 링크 복구가 불가능합니다.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button onClick={() => setDeleteModalTarget(null)} style={{ padding: '8px 14px', border: 'none', background: 'rgba(128,128,128,0.1)', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-muted)', cursor: 'pointer' }}>취소</button>
                  <button onClick={handleRemoveSequence} style={{ padding: '8px 16px', border: 'none', background: '#ef4444', color: '#fff', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>영구 삭제</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* 전체 변수 와이드 리스트 오버레이 편집 팝업 */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isAllVarsPopupOpen && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100020 }} onClick={() => setIsAllVarsPopupOpen(false)}>
              <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} onClick={e => e.stopPropagation()} style={{ width: '480px', maxHeight: '80vh', background: 'var(--bg-modal)', border: 'var(--border-glass)', borderRadius: '18px', padding: '20px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(128,128,128,0.15)', paddingBottom: '8px' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#2563eb', display: 'flex', alignItems: 'center', gap: '6px' }}><Icon.Variable /> 전체 파이프라인 변수 목록</div>
                  <button onClick={() => setIsAllVarsPopupOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}><Icon.Close /></button>
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
                  {variables.map((variable, vIdx) => {
                    const isCurrentEditing = editingVarKeyIdx === vIdx;
                    return (
                      <div key={vIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-input)', border: '1px solid var(--border-glass-input)', borderRadius: '8px', padding: '6px 10px' }}>
                        <input 
                          type="text" 
                          value={isCurrentEditing ? editingVarKeyVal : variable.key} 
                          onChange={e => handleUpdateVariable(vIdx, 'key', e.target.value)} 
                          onKeyDown={e => { if (e.key === 'Enter') handleCommitVariableKey(vIdx); }}
                          onBlur={() => handleCommitVariableKey(vIdx)}
                          placeholder="변수명" 
                          style={{ border: 'none', background: 'transparent', color: '#2563eb', fontWeight: 700, fontSize: '0.78rem', width: '120px', outline: 'none' }} 
                        />
                        <span style={{ color: 'var(--color-text-muted)' }}>:</span>
                        <input type="text" value={variable.value} onChange={e => handleUpdateVariable(vIdx, 'value', e.target.value)} placeholder="기본값" style={{ border: 'none', background: 'transparent', color: 'inherit', fontSize: '0.78rem', flex: 1, outline: 'none' }} />
                        <button onClick={() => handleRemoveVariable(vIdx)} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Icon.Trash /></button>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  <button onClick={handleAddVariable} style={{ border: 'none', background: 'rgba(37,99,235,0.1)', color: '#2563eb', padding: '6px 14px', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><Icon.Plus /> 변수 추가</button>
                  <button onClick={() => setIsAllVarsPopupOpen(false)} style={{ border: 'none', background: 'var(--color-text-main)', color: 'var(--color-btn-text)', padding: '6px 14px', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 700, cursor: 'pointer' }}>닫기</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* 도움말 가상 가이드 팝업 룸 */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isHelpOpen && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(15px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100025 }} onClick={() => setIsHelpOpen(false)}>
              <motion.div initial={{ opacity: 0, y: 15, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.96 }} onClick={e => e.stopPropagation()} style={{ width: '560px', maxHeight: '82vh', background: 'var(--bg-bubble-bot)', border: 'var(--border-glass)', borderRadius: '20px', padding: '24px', boxShadow: '0 25px 60px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', gap: '14px', boxSizing: 'border-box' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(128,128,128,0.15)', paddingBottom: '10px', flexShrink: 0 }}>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icon.AlertCircleBlue /> MCP 파이프라인 자동화 엔진 사용 가이드
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button onClick={() => setIsHelpOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: '0.78rem', color: 'var(--color-text-muted)', cursor: 'pointer', fontWeight: 600, padding: '2px 6px', borderRadius: '4px' }} onMouseEnter={e => e.currentTarget.style.backgroundColor='rgba(128,128,128,0.06)'} onMouseLeave={e => e.currentTarget.style.backgroundColor='transparent'}>닫기</button>
                    <button onClick={() => setIsHelpOpen(false)} style={{ background: 'rgba(128,128,128,0.1)', border: 'none', padding: '5px', borderRadius: '50%', color: 'var(--color-text-main)', cursor: 'pointer', display: 'flex' }}><Icon.Close /></button>
                  </div>
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px', fontSize: '0.92rem', lineHeight: '1.7', color: 'var(--color-text-main)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1.05rem', fontWeight: 700, margin: '0 0 8px 0', color: '#2563eb' }}>
                    <Icon.Lightbulb /> 변수 체이닝 및 포워딩 인프라 구조
                  </div>
                  <p style={{ margin: '0 0 12px 0', color: 'var(--color-text-muted)', paddingLeft: '4px' }}>각 노드(Node) 간의 유기적 통신 및 가변 인자 매핑을 위해 두 가지 강력한 바인딩 토큰을 지원합니다.</p>
                  
                  <blockquote style={{ margin: '12px 0', padding: '10px 14px', borderLeft: '3px solid #2563eb', background: 'rgba(37,99,235,0.04)', borderRadius: '0 8px 8px 0', fontSize: '0.85rem' }}>
                    <strong style={{ color: 'var(--color-text-main)', fontWeight: 800 }}>1. 이전 노드 결과 바인딩 (Node Output Chaining)</strong><br />
                    • 문법 규격: <code style={{ background: 'rgba(128,128,128,0.1)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace', color: '#c2410c' }}>{"{{step_X.output}}"}</code><br />
                    • 직전 또는 이전 차례 노드가 성공적으로 내놓은 실행 결과 텍스트 자원을 런타임에 동적으로 토스받아 치환합니다.
                  </blockquote>

                  <blockquote style={{ margin: '12px 0', padding: '10px 14px', borderLeft: '3px solid #f59e0b', background: 'rgba(245,158,11,0.04)', borderRadius: '0 8px 8px 0', fontSize: '0.85rem' }}>
                    <strong style={{ color: 'var(--color-text-main)', fontWeight: 800 }}>2. 글로벌 파이프라인 가변 변수 (Global Variables)</strong><br />
                    • 문법 규격: <code style={{ background: 'rgba(128,128,128,0.1)', padding: '2px 4px', borderRadius: '4px', fontFamily: 'monospace', color: '#2563eb' }}>{"{{variables.변수명}}"}</code><br />
                    • 상단 변수 관리 바에서 선언한 고유의 캐시 식별자 기본값을 본문에 주입하거나 후속 가동 조건문으로 인라인 결합합니다.
                  </blockquote>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1.05rem', fontWeight: 700, margin: '18px 0 8px 0', color: '#10b981' }}>
                    <Icon.Flash /> core__set_variable 제어 규격
                  </div>
                  <p style={{ margin: '0 0 6px 0', paddingLeft: '4px' }}>파이프라인 중간 흐름에 <code style={{ fontFamily: 'monospace', fontWeight: 700 }}>set_variable</code> 가상 도구 노드를 배치하면, 실물 플러그인 결과물을 전 전역 변수 공간에 실시간으로 대입(저장)하여 후속 노드들의 멀티 체이닝 효율성을 극대화합니다.</p>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1.05rem', fontWeight: 700, margin: '18px 0 8px 0', color: '#2563eb' }}>
                    <Icon.Network /> core__if_condition & core__else_if 다중 제어 분기 규격
                  </div>
                  <p style={{ margin: '0 0 6px 0', paddingLeft: '4px' }}>파이프라인 내부에 `IF` 또는 `ELSE IF` 조건절 노드들을 연속 배치하여 관계식(일치, 포함, 대소관계)을 검증합니다. 한 블록이 충족되어 작동하면 뒤에 오는 조건절들은 자동으로 스킵되며, <code style={{ fontFamily: 'monospace', fontWeight: 700 }}>end_if</code> 종결 노드를 만나면 다중 조건절이 완전히 닫히고 메인 스트림으로 복구됩니다.</p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', flexShrink: 0, marginTop: '4px' }}>
                  <button onClick={() => setIsHelpOpen(false)} style={{ border: 'none', background: 'var(--color-text-main)', color: 'var(--color-btn-text)', padding: '8px 18px', borderRadius: '8px', fontSize: '0.84rem', fontWeight: 700, cursor: 'pointer' }}>확인 완료</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <div style={{ maxWidth: '840px', margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid rgba(128,128,128,0.15)', paddingBottom: '16px' }}>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>Automation Dashboard</h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>더보기 메뉴를 통해 실행 흐름 그래프를 모니터링할 수 있습니다.</p>
          </div>
          <button onClick={() => setIsModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: 'var(--color-text-main)', color: 'var(--color-btn-text)', border: 'none', borderRadius: '10px', fontSize: '0.84rem', fontWeight: 700, cursor: 'pointer' }}><Icon.Plus /> Add Sequence</button>
        </div>

        <section style={{ marginTop: '4px' }}>
          {savedSequences.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', background: 'var(--bg-glass-card)', borderRadius: '16px', border: 'var(--border-glass)' }}><Icon.Empty /><span style={{ fontSize: '0.84rem', color: 'var(--color-text-muted)', marginTop: '8px' }}>등록된 자동화 스케줄 파이프라인이 없습니다.</span></div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px', width: '100%' }}>
              {savedSequences.map((seq) => {
                const isCurrentRunning = runningSequenceId === seq.id;
                const isCurrentFailed = failedSequenceIds.has(seq.id);
                const isCurrentCompleted = completedSequenceIds.has(seq.id);
                const isEnabled = seq.isEnabled !== false && (seq.isEnabled as any) !== 0 && (seq as any).isEnabled !== '0';
  
                const getCardBorderColor = () => {
                  if (!isEnabled) return 'rgba(128, 128, 128, 0.15)'; 
                  if (isCurrentFailed) return '#ef4444';
                  if (isCurrentRunning) return '#3b82f6';
                  if (isCurrentCompleted) return '#10b981'; 
                  return '#f59e0b'; 
                };

                return (
                  <div 
                    key={seq.id} 
                    onClick={() => handleToggleSequenceEnable(seq)} 
                    onMouseEnter={() => setHoveredCardId(seq.id)}
                    onMouseLeave={() => setHoveredCardId(null)}
                    style={{ 
                      background: isEnabled 
                        ? isCurrentRunning ? 'rgba(59, 130, 246, 0.04)'
                          : isCurrentFailed ? 'rgba(239, 68, 68, 0.04)'
                          : isCurrentCompleted ? 'rgba(16, 185, 129, 0.06)'
                          : 'rgba(245, 158, 11, 0.02)'
                        : 'var(--bg-glass-card)', 
                      border: `1px solid ${getCardBorderColor()}`, 
                      borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative', height: '145px', boxSizing: 'border-box', cursor: (isCurrentRunning || isCurrentCompleted) ? 'not-allowed' : 'pointer',
                      opacity: isEnabled ? 1 : 0.42, 
                      transition: 'all 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
                      filter: isEnabled ? 'none' : 'grayscale(100%) brightness(0.9)', 
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', maxWidth: '65%', minWidth: 0 }}>
                        <span style={{ color: isEnabled ? (isCurrentRunning ? '#3b82f6' : '#10b981') : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', opacity: isEnabled ? 1 : 0.35, flexShrink: 0 }}>
                          <Icon.Network />
                        </span>
                        
                        {isEnabled && !isCurrentFailed && !isCurrentCompleted && (
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 5px #10b981', flexShrink: 0 }} />
                        )}

                        {isCurrentFailed && (
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', boxShadow: '0 0 5px #ef4444', flexShrink: 0 }} />
                        )}

                        {isCurrentCompleted && (
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 8px #10b981', flexShrink: 0 }} className="pulse-active-dot" />
                        )}

                        {isCurrentRunning && (
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6', boxShadow: '0 0 5px #3b82f6', marginLeft: '-2px', flexShrink: 0 }} className="pulse-active-dot" />
                        )}
                        
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-main)', opacity: isEnabled ? 1 : 0.55, flexGrow: 1, minWidth: 0 }}>
                          {seq.name}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        <span style={{
                          ...baseBadgeStyle,
                          backgroundColor: isCurrentRunning ? '#3b82f6'
                            : isCurrentFailed ? '#ef4444'
                            : isCurrentCompleted ? '#10b981' 
                            : isEnabled ? '#f59e0b'
                            : 'rgba(128, 128, 128, 0.15)',
                          boxShadow: isCurrentFailed ? '0 2px 6px rgba(239,68,68,0.3)'
                            : isCurrentCompleted ? '0 2px 8px rgba(16,185,129,0.4)'
                            : isEnabled ? (isCurrentRunning ? '0 2px 6px rgba(59,130,246,0.3)' : '0 2px 6px rgba(245,158,11,0.3)') : 'none',
                          color: isEnabled ? '#fff' : 'var(--color-text-muted)',
                          opacity: isEnabled ? 1 : 0.6
                        }} className={isCurrentRunning ? "pulse-running-badge" : isCurrentCompleted ? "pulse-completed-badge" : ""}>
                          {isCurrentRunning ? "running" : isCurrentFailed ? "failed" : isCurrentCompleted ? "completed" : isEnabled ? "ready" : "off"}
                        </span>

                        <span style={{ ...baseBadgeStyle, fontFamily: 'monospace', color: 'var(--color-text-muted)', backgroundColor: 'rgba(128, 128, 128, 0.06)', border: '1px solid rgba(128, 128, 128, 0.15)', opacity: isEnabled ? 1 : 0.4, flexShrink: 0 }}>
                          {seq.cronExpression}
                        </span>
                      </div>
                    </div>
                    
                    <div style={{ flexGrow: 1, fontSize: '0.78rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', opacity: isEnabled ? 1 : 0.5 }}>{seq.description || "상세 기술 명세가 정의되지 않은 워크플로우"}</div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(128,128,128,0.1)', paddingTop: '6px', marginTop: 'auto' }} onClick={e => e.stopPropagation()}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', opacity: isEnabled ? 1 : 0.4 }}>Last: {seq.lastRunTimestamp ? new Date(seq.lastRunTimestamp).toLocaleTimeString() : "Never"}</span>
                      
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button 
                          onClick={() => handleTriggerConfirmModal(seq)} 
                          disabled={!isEnabled || isCurrentRunning || isCurrentCompleted} 
                          style={{ 
                            display: 'flex', alignItems: 'center', gap: '3px', padding: '4px 10px', 
                            background: (isCurrentRunning || isCurrentCompleted) ? 'rgba(128,128,128,0.06)' : isEnabled ? '#10b981' : 'rgba(128,128,128,0.06)', 
                            color: (isCurrentRunning || isCurrentCompleted) ? 'var(--color-text-muted)' : isEnabled ? '#fff' : 'var(--color-text-muted)', 
                            border: 'none', borderRadius: '5px', fontSize: '0.72rem', fontWeight: 700, 
                            cursor: (isEnabled && !isCurrentRunning && !isCurrentCompleted) ? 'pointer' : 'not-allowed', 
                            opacity: isEnabled && !isCurrentRunning && !isCurrentCompleted ? 1 : 0.4 
                          }}
                        >
                          <Icon.Play /> 실행
                        </button>
                        
                        <button 
                          onClick={(e) => handleOpenMenu(e, seq.id)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(128,128,128,0.06)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <Icon.More />
                        </button>
                      </div>
                    </div>

                    {/* 더보기 서브 버블 */}
                    {menuOpenSeqId === seq.id && (
                      <div 
                        ref={menuRef}
                        style={{ position: 'absolute', bottom: '36px', right: '16px', backgroundColor: 'var(--bg-modal)', border: 'var(--border-glass)', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', padding: '4px', zIndex: 100, display: 'flex', flexDirection: 'column', gap: '2px', width: '150px' }}
                        onClick={e => e.stopPropagation()}
                      >
                        <button 
                          onClick={() => handleInspectSequenceGraph(seq)} 
                          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', border: 'none', background: 'transparent', borderRadius: '6px', fontSize: '0.75rem', color: 'var(--color-text-main)', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(128,128,128,0.06)'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <Icon.Edit /> 명세 수정 및 모니터링
                        </button>
                        <button 
                          onClick={() => handleTriggerDeleteModal(seq)} 
                          disabled={isCurrentRunning || isCurrentCompleted}
                          style={{ 
                            display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', border: 'none', 
                            background: 'transparent', borderRadius: '6px', fontSize: '0.75rem', 
                            color: (isCurrentRunning || isCurrentCompleted) ? 'var(--color-text-muted)' : '#ef4444', 
                            cursor: (isCurrentRunning || isCurrentCompleted) ? 'not-allowed' : 'pointer', 
                            textAlign: 'left', width: '100%',
                            opacity: (isCurrentRunning || isCurrentCompleted) ? 0.4 : 1
                          }}
                          onMouseEnter={e => !(isCurrentRunning || isCurrentCompleted) && (e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.06)')}
                          onMouseLeave={e => !(isCurrentRunning || isCurrentCompleted) && (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <Icon.Trash /> 삭제하기
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* 포탈 와이드 팝업 관제 엔진 룸 */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isModalOpen && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }} onClick={closeModal}>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} onClick={e => e.stopPropagation()} style={{ width: '90vw', maxWidth: '1140px', height: '84vh', maxHeight: '720px', background: 'var(--bg-modal)', border: 'var(--border-glass)', boxShadow: '0 30px 80px rgba(0, 0, 0, 0.4)', borderRadius: '20px', display: 'flex', flexDirection: 'column', padding: '20px', boxSizing: 'border-box', gap: '14px', overflow: 'hidden' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(128,128,128,0.15)', paddingBottom: '10px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', color: '#2563eb' }}>
                      {editingSequenceId ? <Icon.Pin /> : <Icon.Gear />}
                    </div>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                      {editingSequenceId ? (runningSequenceId === editingSequenceId ? "Live Pipeline Tracking" : "Edit Automation Graph") : "Create Automation Pipeline"}
                    </h2>
                    
                    {editingSequenceId && (() => {
                      const currentSeq = savedSequences.find(s => s.id === editingSequenceId);
                      const isRunning = runningSequenceId === editingSequenceId;
                      const isCompleted = completedSequenceIds.has(editingSequenceId);
                      const isLockActive = isRunning || isCompleted;

                      return (
                        <button
                          onClick={() => {
                            if (isLockActive) return; 
                            currentSeq && handleTriggerConfirmModal(currentSeq);
                          }}
                          disabled={isLockActive || !currentSeq?.isEnabled}
                          style={{
                            padding: '5px 14px', borderRadius: '6px', border: 'none',
                            background: isRunning ? 'rgba(59, 130, 246, 0.15)'
                              : isCompleted ? 'rgba(16, 185, 129, 0.15)'
                              : currentSeq?.isEnabled ? '#10b981' : 'rgba(128,128,128,0.1)',
                            color: isRunning ? '#3b82f6' : isCompleted ? '#10b981'
                              : currentSeq?.isEnabled ? '#fff' : 'var(--color-text-muted)',
                            fontSize: '0.78rem', fontWeight: 700,
                            cursor: (isLockActive || !currentSeq?.isEnabled) ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px', height: '28px', boxSizing: 'border-box'
                          }}
                        >
                          {isRunning ? (
                            <><span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3b82f6' }} className="pulse-active-dot" /> 가동중</>
                          ) : isCompleted ? (
                            <><span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} /> 완료됨</>
                          ) : (
                            <><Icon.Play /> 실행</>
                          )}
                        </button>
                      );
                    })()}

                    <button 
                      onClick={() => setIsHelpOpen(true)} 
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '50%' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.06)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <Icon.AlertCircleBlue />
                    </button>
                  </div>
                  <button style={{ background: 'rgba(128,128,128,0.1)', border: 'none', padding: '6px', borderRadius: '50%', color: 'var(--color-text-main)', cursor: 'pointer' }} onClick={closeModal}><Icon.Close /></button>
                </div>

                <div style={{ flex: 1, display: 'flex', gap: '16px', overflow: 'hidden', minHeight: 0 }}>
                  
                  {/* 좌측 도구 서랍 판넬 */}
                  <div style={{ width: '250px', minWidth: '250px', display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-glass-card)', border: 'var(--border-glass)', borderRadius: '14px', padding: '12px', boxSizing: 'border-box', height: '100%' }}>
                    <select value={activePluginFilter} onChange={e => setActivePluginFilter(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '6px', background: 'var(--bg-input)', color: 'var(--color-text-main)', border: '1px solid var(--border-glass-input)', fontSize: '0.78rem', fontWeight: 600, flexShrink: 0 }}>
                      <option value="all">전체 플러그인/AI</option>
                      {plugins.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      <option value="AI_Core">AI 코어 가상엔진</option>
                    </select>

                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '2px' }}>
                      {filteredTools.map((tool) => (
                        <motion.div key={tool.name} draggable onDragStart={() => setDraggingTool(tool)} whileHover={{ x: 2 }} style={{ padding: '8px 10px', borderRadius: '8px', background: tool.name.startsWith('ai__') || tool.name.startsWith('core__') ? 'rgba(37,99,235,0.08)' : 'rgba(128,128,128,0.04)', border: '1px solid rgba(128,128,128,0.04)', cursor: 'grab', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                            {(tool.name.startsWith('ai__') || tool.name.startsWith('core__')) ? <Icon.Cpu /> : <Icon.Activity />}
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: tool.name.startsWith('ai__') || tool.name.startsWith('core__') ? '#2563eb' : 'inherit' }}>{tool.name.includes('__') ? tool.name.split('__')[1] : tool.name}</div>
                          </div>
                          {tool.description && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{tool.description}</div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* 우측 실시간 파이프라인 관제 그래프 존 */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', minWidth: 0 }}>
                    
                    {/* 상단 뼈대 설정 바 */}
                    <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-glass-card)', border: 'var(--border-glass)', borderRadius: '12px', padding: '10px', flexShrink: 0 }}>
                      <input type="text" value={sequenceName} onChange={e => setSequenceName(e.target.value)} placeholder="시퀀스 명칭" style={{ flex: 1.5, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-glass-input)', background: 'var(--bg-input)', color: 'inherit', fontSize: '0.78rem', outline: 'none', minWidth: 0 }} />
                      <input type="text" value={sequenceDesc} onChange={e => setSequenceDesc(e.target.value)} placeholder="설명문" style={{ flex: 2, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-glass-input)', background: 'var(--bg-input)', color: 'inherit', fontSize: '0.78rem', outline: 'none', minWidth: 0 }} />
                      <input type="text" value={cronExpr} onChange={e => setCronExpr(e.target.value)} placeholder="Cron (e.g. 0 3 * * *)" style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-glass-input)', background: 'var(--bg-input)', color: 'inherit', fontSize: '0.78rem', fontFamily: 'monospace', outline: 'none', minWidth: 0 }} />
                      <button onClick={handleSaveAutomationPipeline} disabled={steps.length === 0} style={{ padding: '0 16px', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '#0.78rem', fontWeight: 700, cursor: 'pointer', opacity: steps.length > 0 ? 1 : 0.5, flexShrink: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Icon.Target /> {editingSequenceId ? "명세 변경 저장" : "새 저장"}</div>
                      </button>
                    </div>

                    {/* 글로벌 변수 관리 가변 레이어 폴딩 및 보기 고도화 컴포넌트 */}
                    <div style={{ background: 'var(--bg-glass-card)', border: 'var(--border-glass)', borderRadius: '12px', padding: '10px', display: 'flex', flexDirection: 'column', gap: isVarsCollapsed ? '0px' : '8px', flexShrink: 0, transition: 'gap 0.2s ease' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }} onClick={() => setIsVarsCollapsed(!isVarsCollapsed)}>
                          <span style={{ color: '#2563eb', display: 'flex', alignItems: 'center' }}><Icon.Variable /></span>
                          <span style={{ fontSize: '0.76rem', fontWeight: 800, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.03em' }}>글로벌 파이프라인 가변 변수 (Variables)</span>
                          <span style={{ color: 'var(--color-text-muted)', display: 'flex' }}>
                            {isVarsCollapsed ? <Icon.ArrowDown /> : <Icon.ArrowUp />}
                          </span>
                        </div>
                        
                        {!isVarsCollapsed && (
                          <button onClick={handleAddVariable} style={{ border: 'none', background: 'rgba(37,99,235,0.1)', color: '#2563eb', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <Icon.Plus /> 변수 추가
                          </button>
                        )}
                      </div>
                      
                      {!isVarsCollapsed && (
                        <>
                          {variables.length === 0 ? (
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>등록된 고유 가변인자가 없습니다. 각 스텝에서 변수명 단추를 클릭해 자동 매핑 치환 연동이 지원됩니다.</div>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                              {variables.slice(0, 5).map((variable, vIdx) => {
                                const isCurrentEditing = editingVarKeyIdx === vIdx;
                                return (
                                  <div key={vIdx} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-input)', border: '1px solid var(--border-glass-input)', borderRadius: '6px', padding: '2px 6px', height: '24px', boxSizing: 'border-box' }}>
                                    <input 
                                      type="text" 
                                      value={isCurrentEditing ? editingVarKeyVal : variable.key} 
                                      onChange={e => handleUpdateVariable(vIdx, 'key', e.target.value)} 
                                      onKeyDown={e => { if (e.key === 'Enter') handleCommitVariableKey(vIdx); }}
                                      onBlur={() => handleCommitVariableKey(vIdx)}
                                      placeholder="변수명" 
                                      style={{ border: 'none', background: 'transparent', color: '#2563eb', fontWeight: 700, fontSize: '0.72rem', width: '75px', outline: 'none' }} 
                                    />
                                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>:</span>
                                    <input type="text" value={variable.value} onChange={e => handleUpdateVariable(vIdx, 'value', e.target.value)} placeholder="기본값" style={{ border: 'none', background: 'transparent', color: 'inherit', fontSize: '0.72rem', width: '85px', outline: 'none' }} />
                                    <button onClick={() => handleRemoveVariable(vIdx)} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 2px' }}>
                                      <Icon.Trash />
                                    </button>
                                  </div>
                                );
                              })}
                              
                              {variables.length > 5 && (
                                <button 
                                  onClick={() => setIsAllVarsPopupOpen(true)}
                                  style={{ border: '1px dashed #2563eb', background: 'rgba(37,99,235,0.03)', color: '#2563eb', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', cursor: 'pointer', height: '24px' }}
                                >
                                  + {variables.length - 5}개 변수 더보기 및 편집
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* 실시간 드롭 보드 그래프 메인 스페이스 */}
                    <div onDragOver={(e) => e.preventDefault()} onDrop={handleDropOnBoard} style={{ flex: 1, borderRadius: '14px', background: draggingTool ? 'rgba(37, 99, 235, 0.03)' : 'rgba(128,128,128,0.01)', border: draggingTool ? '2px dashed #2563eb' : '1px dashed var(--border-glass-input)', padding: '12px 14px 24px 12px', overflowY: 'auto', minHeight: 0, position: 'relative' }}>
                      {steps.length === 0 ? (
                        <div style={{ display: 'flex', width: '100%', height: '100%', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                          <span style={{ margin: 'auto' }}>좌측 도구들을 이곳에 드롭하여 실행 파이프라인 그래프를 설계하세요.</span>
                        </div>
                      ) : (
                        <Reorder.Group axis="y" values={steps} onReorder={setSteps} style={{ display: 'flex', flexDirection: 'column', gap: '0px', listStyle: 'none', margin: 0, padding: 0 }}>
                          <AnimatePresence initial={false}>
                            {steps.map((step, index) => {
                              const isStepRunning = runningSequenceId === editingSequenceId && activeStepIndex === index;
                              const isStepPassed = runningSequenceId === editingSequenceId && activeStepIndex !== null && activeStepIndex > index;
                              const isStepFailed = failedSequenceIds.has(editingSequenceId ?? '') && failedStepIndex === index;
                              const isCollapsed = collapsedSteps.has(step.id);
                              const isRawJsonMode = rawJsonModeSteps.has(step.id);
                              
                              const matchingToolInfo = availableTools.find(t => t.name === step.fullToolName);

                              let parsedArgs: Record<string, any> = {};
                              try {
                                parsedArgs = JSON.parse(step.argsTemplate);
                              } catch (e) {
                                parsedArgs = {};
                              }

                              return (
                                <React.Fragment key={step.id}>
                                  {index > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '22px', margin: '2px 0', flexShrink: 0 }}>
                                      <Icon.FlowDown />
                                    </div>
                                  )}
                                  
                                  <Reorder.Item 
                                    key={step.id} 
                                    value={step} 
                                    whileDrag={{ scale: 0.99 }} 
                                    style={{ 
                                      position: 'relative',
                                      display: 'flex', flexDirection: 'column', gap: isCollapsed ? '0px' : '6px', 
                                      background: 'var(--bg-glass-card)', 
                                      border: isStepRunning ? '1.5px solid #10b981'
                                        : isStepFailed ? '1.5px solid #ef4444'
                                        : isStepPassed ? '1px solid rgba(16, 185, 129, 0.4)'
                                        : (step.fullToolName.startsWith('ai__') || step.fullToolName.startsWith('core__')) ? '1px solid rgba(37,99,235,0.3)' : 'var(--border-glass)', 
                                      borderRadius: '12px', padding: '10px 14px', cursor: 'grab', 
                                      boxShadow: isStepRunning ? '0 0 15px rgba(16, 185, 129, 0.15)'
                                        : isStepFailed ? '0 0 15px rgba(239, 68, 68, 0.15)' : '0 2px 8px rgba(0,0,0,0.02)', 
                                      flexShrink: 0,
                                      zIndex: activeChipMenuId?.startsWith(step.id) ? 100 : 2,
                                      transition: 'border-color 0.3s ease, box-shadow 0.3s ease, gap 0.2s ease'
                                    }}
                                  >
                                    {isStepFailed && tooltipStepId === step.id && failedError && (
                                      <div style={{ position: 'absolute', bottom: 'calc(100% + 8px)', left: '0', right: '0', background: 'rgba(30, 15, 15, 0.96)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '8px', padding: '8px 12px', fontSize: '0.74rem', color: '#fca5a5', lineHeight: '1.45', zIndex: 200, backdropFilter: 'blur(8px)', boxShadow: '0 8px 20px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'flex-start', gap: '6px', pointerEvents: 'none' }}>
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" style={{ flexShrink: 0, marginTop: '1px' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                        <span>{failedError}</span>
                                      </div>
                                    )}
                                    
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: isStepRunning ? '#10b981' : isStepFailed ? '#ef4444' : (step.fullToolName.startsWith('ai__') || step.fullToolName.startsWith('core__')) ? '#2563eb' : 'var(--color-text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        
                                        {isStepFailed ? (
                                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ef4444', boxShadow: '0 0 6px #ef4444', marginRight: '4px' }} />
                                        ) : isStepRunning ? (
                                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 6px #10b981', marginRight: '4px' }} className="pulse-active-dot" />
                                        ) : isStepPassed ? (
                                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', marginRight: '4px' }} />
                                        ) : null}

                                        {(step.fullToolName.startsWith('ai__') || step.fullToolName.startsWith('core__')) ? <Icon.Cpu /> : <Icon.Activity />}
                                        [Node {index}] {step.fullToolName.includes('__') ? step.fullToolName.split('__')[1] : step.fullToolName}
                                        <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: '6px' }}>({step.pluginId})</span>
                                      </div>
                                      
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} onClick={e => e.stopPropagation()}>
                                        {!isCollapsed && step.fullToolName !== 'core__end_if' && (
                                          <button 
                                            onClick={() => toggleRawJsonMode(step.id)}
                                            style={{ border: '1px solid var(--border-glass-input)', background: isRawJsonMode ? 'rgba(37,99,235,0.1)' : 'transparent', color: isRawJsonMode ? '#2563eb' : 'var(--color-text-muted)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.68rem', fontWeight: 600, cursor: 'pointer' }}
                                          >
                                            {isRawJsonMode ? 'Form UI' : 'Raw JSON'}
                                          </button>
                                        )}

                                        <button 
                                          onClick={() => toggleStepCollapse(step.id)}
                                          style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', borderRadius: '4px' }}
                                          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(128,128,128,0.06)'}
                                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                                        >
                                          {isCollapsed ? <Icon.ArrowDown /> : <Icon.ArrowUp />}
                                        </button>
                                        
                                        <button 
                                          onClick={() => handleRemoveStep(step.id)} 
                                          style={{ background: 'transparent', border: 'none', color: '#ef4444', fontWeight: 700, cursor: 'pointer', fontSize: '0.72rem', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                        >
                                          <Icon.AlertCircleRed /> 삭제
                                        </button>
                                      </div>
                                    </div>
                                    
                                    <AnimatePresence initial={false}>
                                      {!isCollapsed && (
                                        <motion.div
                                          initial={{ opacity: 0, height: 0 }}
                                          animate={{ opacity: 1, height: 'auto' }}
                                          exit={{ opacity: 0, height: 0 }}
                                          transition={{ duration: 0.2, ease: 'easeInOut' }}
                                          style={{ display: 'flex', flexDirection: 'column', gap: '6px' }} 
                                        >
                                          {matchingToolInfo?.description && (
                                            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', padding: '2px 0', lineHeight: '1.4' }}>
                                              {matchingToolInfo.description}
                                            </div>
                                          )}

                                          {isRawJsonMode ? (
                                            <textarea 
                                              value={step.argsTemplate} 
                                              onChange={e => handleStepArgsChange(step.id, e.target.value)} 
                                              rows={4} 
                                              style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-glass-input)', background: 'var(--bg-input)', color: 'inherit', fontFamily: 'monospace', fontSize: '0.74rem', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} 
                                            />
                                          ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-input)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-glass-input)', position: 'relative' }}>
                                              
                                              {/* 1. 변수 할당용 전용 가상 폼 UI */}
                                              {step.fullToolName === 'core__set_variable' ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-main)' }}>대상 변수 선택 (Target Variable)</label>
                                                    <select 
                                                      value={parsedArgs.target_variable || ""} 
                                                      onChange={e => handleStructuredFieldChange(step.id, step.argsTemplate, 'target_variable', e.target.value)}
                                                      style={{ width: '100%', padding: '5px 8px', borderRadius: '5px', border: '1px solid var(--border-glass-input)', background: 'var(--bg-modal)', color: 'inherit', fontSize: '0.74rem', outline: 'none' }}
                                                    >
                                                      <option value="">-- 값을 저장할 변수 선택 --</option>
                                                      {variables.map(v => <option key={v.key} value={v.key}>{v.key}</option>)}
                                                    </select>
                                                  </div>

                                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px', position: 'relative' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-main)' }}>대입할 값 (Value to Store)</label>
                                                      
                                                      <div style={{ position: 'relative' }}>
                                                        <button
                                                          type="button"
                                                          onClick={(e) => { e.stopPropagation(); setActiveChipMenuId(activeChipMenuId === `${step.id}_val` ? null : `${step.id}_val`); }}
                                                          style={sharedChipBtnStyle('rgba(37,99,235,0.1)', '#2563eb')}
                                                        >
                                                          <Icon.Link /> 바인딩 선택
                                                        </button>

                                                        {activeChipMenuId === `${step.id}_val` && (
                                                          <div ref={chipMenuRef} style={{ position: 'absolute', right: 0, top: '22px', backgroundColor: 'var(--bg-modal)', border: 'var(--border-glass)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', padding: '6px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '4px', width: '220px', maxHeight: '180px', overflowY: 'auto' }}>
                                                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--color-text-muted)', borderBottom: '1px solid rgba(128,128,128,0.1)', paddingBottom: '2px' }}>노드 결과 풀</div>
                                                            {index > 0 ? (
                                                              <button type="button" onClick={() => { handleStructuredFieldChange(step.id, step.argsTemplate, 'value_to_store', `{{step_${index - 1}.output}}`); setActiveChipMenuId(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', fontSize: '0.68rem', padding: '5px', cursor: 'pointer', color: 'var(--color-text-main)', borderRadius: '4px' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(128,128,128,0.06)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Node {index - 1} 결과 대입</button>
                                                            ) : <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', padding: '2px 4px' }}>이전 단계 없음</span>}
                                                            
                                                            <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--color-text-muted)', borderTop: '1px solid rgba(128,128,128,0.1)', paddingTop: '4px', paddingBottom: '2px' }}>글로벌 가변 변수 단일 대입</div>
                                                            {variables.map(v => (
                                                              <button key={v.key} type="button" onClick={() => { handleStructuredFieldChange(step.id, step.argsTemplate, 'value_to_store', `{{variables.${v.key}}}`); setActiveChipMenuId(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', fontSize: '0.68rem', padding: '5px', cursor: 'pointer', color: '#2563eb', fontWeight: 600, borderRadius: '4px' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(128,128,128,0.06)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>{v.key} 대입</button>
                                                            ))}
                                                          </div>
                                                        )}
                                                      </div>
                                                    </div>
                                                    <input 
                                                      type="text"
                                                      value={parsedArgs.value_to_store || ""}
                                                      onChange={e => handleStructuredFieldChange(step.id, step.argsTemplate, 'value_to_store', e.target.value)}
                                                      placeholder="값을 기입하거나 바인딩 선택 팝업을 활용해 단일 대입하세요."
                                                      style={{ width: '100%', padding: '5px 8px', borderRadius: '5px', border: '1px solid var(--border-glass-input)', background: 'var(--bg-modal)', color: 'inherit', fontSize: '0.74rem', outline: 'none', boxSizing: 'border-box' }}
                                                    />
                                                  </div>
                                                </div>
                                              ) : (step.fullToolName === 'core__if_condition' || step.fullToolName === 'core__else_if') ? (
                                                /* 2. 💡 [다중 분기 대응] IF 및 ELSE IF 노드 통합 빌더 레이아웃 마운트 */
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                  <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#2563eb' }}>
                                                    {step.fullToolName === 'core__if_condition' ? '🛑 IF (최초 조건)' : '🌿 ELSE IF (추가 다중 조건)'}
                                                  </div>
                                                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1.5fr', gap: '8px', alignItems: 'flex-end' }}>
                                                    <div>
                                                      <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>Left Value</label>
                                                      <input 
                                                        type="text" 
                                                        value={parsedArgs.left_value || ""} 
                                                        onChange={e => handleStructuredFieldChange(step.id, step.argsTemplate, 'left_value', e.target.value)}
                                                        placeholder="예: {{step_0.output}} 또는 {{variables.my_var}}"
                                                        style={{ width: '100%', padding: '5px 8px', borderRadius: '5px', border: '1px solid var(--border-glass-input)', background: 'var(--bg-modal)', color: 'inherit', fontSize: '0.74rem', boxSizing: 'border-box' }}
                                                      />
                                                    </div>
                                                    <div>
                                                      <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>Operator</label>
                                                      <select 
                                                        value={parsedArgs.operator || "equals"} 
                                                        onChange={e => handleStructuredFieldChange(step.id, step.argsTemplate, 'operator', e.target.value)}
                                                        style={{ width: '100%', padding: '5px 4px', borderRadius: '5px', border: '1px solid var(--border-glass-input)', background: 'var(--bg-modal)', color: 'inherit', fontSize: '0.74rem', height: '28px', outline: 'none' }}
                                                      >
                                                        <option value="equals">== (일치)</option>
                                                        <option value="not_equals">!= (불일치)</option>
                                                        <option value="contains">contains (포함)</option>
                                                        <option value="not_contains">not contains</option>
                                                        <option value="greater_than">&gt; (큼)</option>
                                                        <option value="less_than">&lt; (작음)</option>
                                                        <option value="greater_than_or_equal">&gt;= (크거나 같음)</option>
                                                        <option value="less_than_or_equal">&lt;= (작거나 같음)</option>
                                                      </select>
                                                    </div>
                                                    <div>
                                                      <label style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>Right Value</label>
                                                      <input 
                                                        type="text" 
                                                        value={parsedArgs.right_value || ""} 
                                                        onChange={e => handleStructuredFieldChange(step.id, step.argsTemplate, 'right_value', e.target.value)}
                                                        placeholder="예: 27 또는 성공"
                                                        style={{ width: '100%', padding: '5px 8px', borderRadius: '5px', border: '1px solid var(--border-glass-input)', background: 'var(--bg-modal)', color: 'inherit', fontSize: '0.74rem', boxSizing: 'border-box' }}
                                                      />
                                                    </div>
                                                  </div>
                                                </div>
                                              ) : step.fullToolName === 'core__end_if' ? (
                                                /* 3. 💡 [다중 분기 대응] END IF 처리 마커 양식 마운트 */
                                                <div style={{ fontSize: '0.72rem', color: '#2563eb', textAlign: 'center', padding: '6px', fontWeight: 600, background: 'rgba(37,99,235,0.04)', borderRadius: '6px' }}>
                                                  🛑 이 지점부터 전체 다중 조건절 체인이 완전히 닫히고, 하위 노드들의 메인 스트림 흐름이 재개됩니다.
                                                </div>
                                              ) : (
                                                /* 4. 일반 실물 플러그인 또는 ask_llm properties 입력 양식 루프 */
                                                matchingToolInfo?.input_schema?.properties && Object.keys(matchingToolInfo.input_schema.properties).length > 0 ? (
                                                  Object.keys(matchingToolInfo.input_schema.properties).map((propKey) => {
                                                    const propDetails = matchingToolInfo.input_schema.properties[propKey] || {};
                                                    const currentVal = parsedArgs[propKey] ?? "";
                                                    const menuKey = `${step.id}_${propKey}`;

                                                    return (
                                                      <div key={propKey} style={{ display: 'flex', flexDirection: 'column', gap: '3px', position: 'relative' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                          <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                                                            {propKey} <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>({propDetails.type || 'string'})</span>
                                                          </label>

                                                          <div style={{ position: 'relative' }}>
                                                            <button
                                                              type="button"
                                                              onClick={(e) => { e.stopPropagation(); setActiveChipMenuId(activeChipMenuId === menuKey ? null : menuKey); }}
                                                              style={sharedChipBtnStyle('rgba(37,99,235,0.06)', '#2563eb')}
                                                            >
                                                              <Icon.Link /> 바인딩 선택
                                                            </button>

                                                            {activeChipMenuId === menuKey && (
                                                              <div ref={chipMenuRef} style={{ position: 'absolute', right: 0, top: '22px', backgroundColor: 'var(--bg-modal)', border: 'var(--border-glass)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', padding: '6px', zIndex: 1010, display: 'flex', flexDirection: 'column', gap: '4px', width: '200px', maxHeight: '180px', overflowY: 'auto' }}>
                                                                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--color-text-muted)', borderBottom: '1px solid rgba(128,128,128,0.1)', paddingBottom: '2px' }}>출력 데이터 연동</div>
                                                                {index > 0 ? (
                                                                  <button type="button" onClick={() => { handleStructuredFieldChange(step.id, step.argsTemplate, propKey, `{{step_${index - 1}.output}}`, true); setActiveChipMenuId(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', fontSize: '0.68rem', padding: '5px', cursor: 'pointer', color: 'var(--color-text-main)', borderRadius: '4px' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(128,128,128,0.06)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>Node {index - 1} 결과 연동</button>
                                                                ) : <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', padding: '2px 4px' }}>이전 단계 없음</span>}
                                                                
                                                                <div style={{ fontSize: '0.65rem', fontWeight: 800, color: 'var(--color-text-muted)', borderTop: '1px solid rgba(128,128,128,0.1)', paddingTop: '4px', paddingBottom: '2px' }}>멀티 변수 호출 체이닝</div>
                                                                {variables.map(v => (
                                                                  <button key={v.key} type="button" onClick={() => { handleStructuredFieldChange(step.id, step.argsTemplate, propKey, `{{variables.${v.key}}}`, true); setActiveChipMenuId(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', fontSize: '0.68rem', padding: '5px', cursor: 'pointer', color: '#2563eb', fontWeight: 600, borderRadius: '4px' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(128,128,128,0.06)'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>{v.key} 추가</button>
                                                                ))}
                                                              </div>
                                                            )}
                                                          </div>
                                                        </div>

                                                        {propDetails.description && (
                                                          <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>{propDetails.description}</span>
                                                        )}

                                                        <input 
                                                          type="text" 
                                                          value={currentVal}
                                                          onChange={e => handleStructuredFieldChange(step.id, step.argsTemplate, propKey, e.target.value)}
                                                          placeholder="값을 기입하거나 바인딩 선택 단추를 눌러 변수 마커를 누적해 보세요."
                                                          style={{ width: '100%', padding: '5px 8px', borderRadius: '5px', border: '1px solid var(--border-glass-input)', background: 'var(--bg-modal)', color: 'inherit', fontSize: '0.74rem', outline: 'none', boxSizing: 'border-box' }}
                                                        />
                                                      </div>
                                                    );
                                                  })
                                                ) : (
                                                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '4px 0' }}>제어할 수 있는 Input Parameter가 없는 도구입니다.</div>
                                                )
                                              )}
                                            </div>
                                          )}
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  </Reorder.Item>
                                </React.Fragment>
                              );
                            })}
                          </AnimatePresence>
                        </Reorder.Group>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}