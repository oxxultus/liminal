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

interface SavedSequence {
  id: string;
  name: string;
  description: string;
  cronExpression: string;
  isEnabled: boolean; 
  lastRunTimestamp: number | null;
  steps?: SelectedStep[]; 
}

const Icon = {
  Plus: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Trash: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
  Play: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  Close: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Clock: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Help: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  ArrowDown: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>,
  Empty: () => <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>,
  Gear: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  Pin: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-.44-1.24l-2.12-2.58A2 2 0 0 1 16 10.18V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v5.18a2 2 0 0 1-.44 1.24L5.44 14a2 2 0 0 0-.44 1.24z"/></svg>,
  Lightbulb: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px', flexShrink: 0 }}><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5.5 5.5 0 0 0 12.5 2.5a5.5 5.5 0 0 0-5.5 5.5c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>,
  Target: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>,
  Cpu: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" style={{ marginRight: '6px', flexShrink: 0 }}><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="24"/><line x1="15" y1="20" x2="15" y2="24"/><line x1="20" y1="9" x2="24" y2="9"/><line x1="20" y1="15" x2="24" y2="15"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="15" x2="4" y2="15"/></svg>,
  AlertCircle: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '4px', flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  More: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>,
  Edit: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z"/></svg>,
  Activity: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  Network: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M12 8v8M5 16v-3a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/></svg>
};

export default function AutomationView() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savedSequences, setSavedSequences] = useState<SavedSequence[]>([]);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  
  const [plugins, setPlugins] = useState<any[]>([]);
  const [availableTools, setAvailableTools] = useState<McpTool[]>([]);
  const [activePluginFilter, setActivePluginFilter] = useState('all');
  
  // 에디터 제어 훅
  const [editingSequenceId, setEditingSequenceId] = useState<string | null>(null);
  const [sequenceName, setSequenceName] = useState('');
  const [sequenceDesc, setSequenceDesc] = useState('');
  const [cronExpr, setCronExpr] = useState('0 3 * * *'); 
  const [steps, setSteps] = useState<SelectedStep[]>([]);
  const [draggingTool, setDraggingTool] = useState<McpTool | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 실시간 관제 및 네이티브 컨펌 대체 브릿지 훅
  const [runningSequenceId, setRunningSequenceId] = useState<string | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState<number | null>(null);
  const [confirmModalTarget, setConfirmModalTarget] = useState<SavedSequence | null>(null);
  const [deleteModalTarget, setDeleteModalTarget] = useState<SavedSequence | null>(null);

  const [menuOpenSeqId, setMenuOpenSeqId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
    setAvailableTools([aiVirtualTool, ...mappedTools]);

    if (window.electronAPI.getAutomationSequences) {
      const savedList = await window.electronAPI.getAutomationSequences().catch(() => []);
      setSavedSequences(savedList);
    }
  };

  useEffect(() => {
    fetchAutomationData();

    // ✅ 크론 실행 이벤트 수신
    if (window.electronAPI.onSequenceStatus) {
        window.electronAPI.onSequenceStatus((data: {
        sequenceId: string;
        status: 'running' | 'completed' | 'failed';
        stepIndex: number | null;
        error?: string;
        }) => {
        if (data.status === 'running') {
            setRunningSequenceId(data.sequenceId);
            setActiveStepIndex(data.stepIndex);
        } else if (data.status === 'completed') {
            setRunningSequenceId(null);
            setActiveStepIndex(null);
            fetchAutomationData();
            setToastMessage(`🎯 [스케줄 자동 실행] 파이프라인이 성공적으로 완료되었습니다.`);
            setTimeout(() => setToastMessage(null), 3500);
        } else if (data.status === 'failed') {
            setRunningSequenceId(null);
            setActiveStepIndex(null);
            fetchAutomationData();
            setToastMessage(`❌ [스케줄 실행 실패] ${data.error}`);
            setTimeout(() => setToastMessage(null), 4000);
        }
        });
    }

    const handleOutsideClick = (e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenSeqId(null);
        }
    };
    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
        document.removeEventListener('mousedown', handleOutsideClick);
        window.electronAPI.offSequenceStatus?.();
    };
}, []);

  const filteredTools = activePluginFilter === 'all' 
    ? availableTools 
    : availableTools.filter(t => t.pluginId === activePluginFilter);

  const triggerHelpToast = () => {
    setToastMessage("변수 체이닝 가이드: 앞선 스텝의 결과물은 {{step_0.output}} 마커를 하위 스텝의 인자에 포워딩하여 결합할 수 있습니다.");
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleDropOnBoard = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggingTool) return;

    const defaultSchema = draggingTool.name === 'ai__ask_llm'
      ? '{\n  "prompt": "여기에 프롬프트를 입력하세요.\\n\\n이전 데이터: {{step_0.output}}"\n}'
      : JSON.stringify(Object.keys(draggingTool.input_schema.properties || {}).reduce((acc: any, key) => { acc[key] = "값 기입"; return acc; }, {}), null, 2);

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

  const handleToggleSequenceEnable = async (seq: SavedSequence) => {
    const nextStatus = !seq.isEnabled;

    // ✅ 클릭 즉시 로컬 상태 선 반영 (Optimistic Update)
    setSavedSequences(prev =>
        prev.map(s => s.id === seq.id ? { ...s, isEnabled: nextStatus } : s)
    );

    if (!window.electronAPI.toggleSequenceStatus) {
        // preload에 메서드가 없으면 로컬 상태만 토글된 채로 유지
        console.warn('toggleSequenceStatus IPC 메서드가 preload에 노출되지 않았습니다.');
        return;
    }

    const res = await window.electronAPI.toggleSequenceStatus({
        sequenceId: seq.id,
        isEnabled: nextStatus
    });

    if (res && res.success) {
        // DB 실제값으로 최종 동기화
        await fetchAutomationData();
    } else {
        // ❌ 실패 시 원래 상태로 롤백
        setSavedSequences(prev =>
        prev.map(s => s.id === seq.id ? { ...s, isEnabled: seq.isEnabled } : s)
        );
        setToastMessage(`상태 업데이트 실패: ${res?.error}`);
        setTimeout(() => setToastMessage(null), 3000);
    }
    };

  const handleInspectSequenceGraph = (seq: SavedSequence) => {
    setEditingSequenceId(seq.id);
    setSequenceName(seq.name);
    setSequenceDesc(seq.description);
    setCronExpr(seq.cronExpression || '0 3 * * *'); 
    setSteps(seq.steps || []); 
    setIsModalOpen(true);
    setMenuOpenSeqId(null);
  };

  const handleOpenMenu = (e: React.MouseEvent, seqId: string) => {
    e.stopPropagation();
    setMenuOpenSeqId(menuOpenSeqId === seqId ? null : seqId);
  };

  const handleTriggerConfirmModal = (seq: SavedSequence) => {
    if (!seq.isEnabled) {
      setToastMessage("비활성화된 시퀀스는 즉시 가동할 수 없습니다. 카드를 클릭하여 먼저 활성화하세요.");
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }
    setConfirmModalTarget(seq);
  };

  const handleExecuteNowWithTracking = async () => {
    if (!confirmModalTarget) return;
    const seq = confirmModalTarget;
    setConfirmModalTarget(null);

    setRunningSequenceId(seq.id);
    setActiveStepIndex(0);
    handleInspectSequenceGraph(seq);

    try {
        if (window.electronAPI.triggerSequenceNow) {
        const totalSteps = seq.steps?.length || 0;
        for (let i = 0; i < totalSteps; i++) {
            setActiveStepIndex(i);
            await new Promise(resolve => setTimeout(resolve, 800));
        }

        const res = await window.electronAPI.triggerSequenceNow(seq.id);
        await fetchAutomationData();

        if (res && res.success) {
            setToastMessage(`🎯 [${seq.name}] 파이프라인 관제 공정이 안전하게 완료되었습니다.`);
            setTimeout(() => setToastMessage(null), 3500);
        } else {
            setToastMessage(`❌ 가동 도중 에러 감지: ${res.error}`);
            setTimeout(() => setToastMessage(null), 4000);
        }
        }
    } finally {
        // ✅ 성공/실패 무관하게 항상 running 상태 초기화 (stale closure 없음)
        setRunningSequenceId(null);
        setActiveStepIndex(null);
    }
    };

  const handleTriggerDeleteModal = (seq: SavedSequence) => {
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
        setIsModalOpen(false);
        // ✅ runningSequenceId는 건드리지 않음 — 실행이 끝나면 자연히 초기화됨
    };

  const handleSaveAutomationPipeline = async () => {
    if (!sequenceName.trim() || steps.length === 0) {
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
      steps: formattedSteps
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

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
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
        .pulse-active-dot {
          animation: pulse-green 1.4s infinite cubic-bezier(0.4, 0, 0.6, 1);
        }
        .pulse-running-badge {
          animation: mcp-network-pulse 1.5s infinite;
        }
      `}</style>
      
      {/* 플로팅 헬프 토스트 */}
      <AnimatePresence>
        {toastMessage && typeof document !== 'undefined' && createPortal(
          <motion.div initial={{ opacity: 0, y: -20, x: 20 }} animate={{ opacity: 1, y: 0, x: 0 }} exit={{ opacity: 0, y: -10 }} style={{ position: 'fixed', top: '20px', right: '20px', width: '320px', background: 'rgba(30, 30, 38, 0.95)', border: '1px solid rgba(59, 130, 246, 0.4)', borderRadius: '12px', padding: '14px', boxShadow: '0 12px 30px rgba(0,0,0,0.25)', color: '#FFFFFF', fontSize: '0.8rem', zIndex: 11000, backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <Icon.Lightbulb />
            <div>{toastMessage}</div>
          </motion.div>,
          document.body
        )}
      </AnimatePresence>

      {/* 실행 제어 전용 커스텀 글래스모피즘 컨펌 팝업 */}
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

      {/* 소거 삭제 전용 커스텀 글래스모피즘 컨펌 팝업 */}
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
                const isEnabled = !!seq.isEnabled;
                
                // 💡 [해결] 비활성화(off) 상태일 때 가이드라인 색상을 물리적으로 도려내고 투명한 유리 회색선으로 고정
                const getCardBorderColor = () => {
                  if (!isEnabled) return 'rgba(128, 128, 128, 0.12)'; 
                  return isCurrentRunning ? '#3b82f6' : '#10b981';
                };

                return (
                <div 
                    key={seq.id} 
                    onClick={() => handleToggleSequenceEnable(seq)} 
                    onMouseEnter={() => setHoveredCardId(seq.id)}
                    onMouseLeave={() => setHoveredCardId(null)}
                    style={{ 
                    background: isEnabled 
                        ? (isCurrentRunning ? 'rgba(59, 130, 246, 0.04)' : 'rgba(16, 185, 129, 0.04)') 
                        : 'var(--bg-glass-card)',
                    border: `1px solid ${getCardBorderColor()}`, 
                    borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', 
                    gap: '10px', position: 'relative', height: '145px', boxSizing: 'border-box', cursor: 'pointer',
                    opacity: isEnabled ? 1 : 0.52,
                    transition: 'border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease, opacity 0.2s ease',
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', maxWidth: '65%' }}>
                        <span style={{ color: isEnabled ? (isCurrentRunning ? '#3b82f6' : '#10b981') : 'var(--color-text-muted)', display: 'flex', alignItems: 'center', opacity: isEnabled ? 1 : 0.4 }}>
                        <Icon.Network />
                        </span>
                        
                        {isEnabled && (
                        <span style={{ 
                            width: '6px', height: '6px', borderRadius: '50%', 
                            backgroundColor: '#10b981',
                            boxShadow: '0 0 5px #10b981'
                        }} />
                        )}

                        {isCurrentRunning && (
                        <span style={{
                            width: '6px', height: '6px', borderRadius: '50%',
                            backgroundColor: '#3b82f6',
                            boxShadow: '0 0 5px #3b82f6',
                            marginLeft: '-2px',
                            animation: 'mcp-network-pulse 1.5s infinite' 
                        }} className="pulse-active-dot" />
                        )}
                        
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-main)', opacity: isEnabled ? 1 : 0.6 }}>
                        {seq.name}
                        </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        <span style={{
                        ...baseBadgeStyle,
                        backgroundColor: isCurrentRunning ? '#3b82f6' : (isEnabled ? '#10b981' : 'rgba(128, 128, 128, 0.15)'), 
                        boxShadow: isEnabled ? (isCurrentRunning ? '0 2px 6px rgba(59,130,246,0.3)' : '0 2px 6px rgba(16,185,129,0.3)') : 'none',
                        color: isEnabled ? '#fff' : 'var(--color-text-muted)',
                        opacity: isEnabled ? 1 : 0.5
                        }} className={isCurrentRunning ? "pulse-running-badge" : ""}>
                        {isCurrentRunning ? "running" : (isEnabled ? "ready" : "off")}
                        </span>

                        <span style={{ ...baseBadgeStyle, fontFamily: 'monospace', color: 'var(--color-text-muted)', backgroundColor: 'rgba(128, 128, 128, 0.06)', border: '1px solid rgba(128, 128, 128, 0.15)', opacity: isEnabled ? 1 : 0.4 }}>
                        {seq.cronExpression}
                        </span>
                    </div>
                    </div>
                    
                    <div style={{ flexGrow: 1, fontSize: '0.78rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', opacity: isEnabled ? 1 : 0.5 }}>
                    {seq.description || "상세 기술 명세가 정의되지 않은 워크플로우"}
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(128,128,128,0.1)', paddingTop: '6px', marginTop: 'auto' }} onClick={e => e.stopPropagation()}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', opacity: isEnabled ? 1 : 0.5 }}>
                        Last: {seq.lastRunTimestamp ? new Date(seq.lastRunTimestamp).toLocaleTimeString() : "Never"}
                    </span>
                    
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button 
                        onClick={() => handleTriggerConfirmModal(seq)} 
                        disabled={!isEnabled} 
                        style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '4px 10px', background: isEnabled ? '#10b981' : 'rgba(128,128,128,0.06)', color: isEnabled ? '#fff' : 'var(--color-text-muted)', border: 'none', borderRadius: '5px', fontSize: '0.72rem', fontWeight: 700, cursor: isEnabled ? 'pointer' : 'not-allowed', opacity: isEnabled ? 1 : 0.4 }}
                        >
                        <Icon.Play /> 실행
                        </button>
                        
                        <button 
                        onClick={(e) => handleOpenMenu(e, seq.id)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(128,128,128,0.06)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                        <Icon.More />
                        </button>
                    </div>
                    </div>

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
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', border: 'none', background: 'transparent', borderRadius: '6px', fontSize: '0.75rem', color: '#ef4444', cursor: 'pointer', textAlign: 'left', width: '100%' }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.06)'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
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
                
                {/* 상단 툴바 헤더 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(128,128,128,0.15)', paddingBottom: '10px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', color: '#2563eb' }}>
                      {editingSequenceId ? <Icon.Pin /> : <Icon.Gear />}
                    </div>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800 }}>
                      {editingSequenceId ? (runningSequenceId === editingSequenceId ? "Live Pipeline Tracking" : "Edit Automation Graph") : "Create Automation Pipeline"}
                    </h2>
                    <button onClick={triggerHelpToast} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}><Icon.Help /></button>
                  </div>
                  <button onClick={closeModal} style={{ background: 'rgba(128,128,128,0.1)', border: 'none', padding: '6px', borderRadius: '50%', color: 'var(--color-text-main)', cursor: 'pointer' }}><Icon.Close /></button>
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
                        <motion.div key={tool.name} draggable onDragStart={() => setDraggingTool(tool)} whileHover={{ x: 2 }} style={{ padding: '8px 10px', borderRadius: '8px', background: tool.name === 'ai__ask_llm' ? 'rgba(37,99,235,0.08)' : 'rgba(128,128,128,0.04)', border: '1px solid rgba(128,128,128,0.08)', cursor: 'grab', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                          {tool.name === 'ai__ask_llm' && <Icon.Cpu />}
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: tool.name === 'ai__ask_llm' ? '#2563eb' : 'inherit' }}>{tool.name.includes('__') ? tool.name.split('__')[1] : tool.name}</div>
                        </motion.div>
                      ))}
                    </div>
                  </div>

                  {/* 우측 실시간 파이프라인 관제 그래프 존 */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', height: '100%', minWidth: 0 }}>
                    
                    <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-glass-card)', border: 'var(--border-glass)', borderRadius: '12px', padding: '10px', flexShrink: 0 }}>
                        <input type="text" value={sequenceName} onChange={e => setSequenceName(e.target.value)} placeholder="시퀀스 명칭" style={{ flex: 1.5, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-glass-input)', background: 'var(--bg-input)', color: 'inherit', fontSize: '0.78rem', outline: 'none', minWidth: 0 }} />
                        <input type="text" value={sequenceDesc} onChange={e => setSequenceDesc(e.target.value)} placeholder="설명문" style={{ flex: 2, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-glass-input)', background: 'var(--bg-input)', color: 'inherit', fontSize: '0.78rem', outline: 'none', minWidth: 0 }} />
                        <input type="text" value={cronExpr} onChange={e => setCronExpr(e.target.value)} placeholder="Cron (e.g. 0 3 * * *)" style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-glass-input)', background: 'var(--bg-input)', color: 'inherit', fontSize: '0.78rem', fontFamily: 'monospace', outline: 'none', minWidth: 0 }} />
                        
                        <button onClick={handleSaveAutomationPipeline} disabled={steps.length === 0} style={{ padding: '0 16px', borderRadius: '6px', border: 'none', background: '#2563eb', color: '#fff', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', opacity: steps.length > 0 ? 1 : 0.5, flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Icon.Target /> {editingSequenceId ? "명세 변경 저장" : "새 저장"}</div>
                        </button>

                        {/* ✅ 편집 모드일 때만 실행 버튼 노출 */}
                        {editingSequenceId && (() => {
                            const currentSeq = savedSequences.find(s => s.id === editingSequenceId);
                            const isRunning = runningSequenceId === editingSequenceId;
                            return (
                            <button
                                onClick={() => currentSeq && handleTriggerConfirmModal(currentSeq)}
                                disabled={!currentSeq || !currentSeq.isEnabled || isRunning}
                                style={{
                                padding: '0 14px', borderRadius: '6px', border: 'none',
                                background: isRunning ? 'rgba(16,185,129,0.15)' : '#10b981',
                                color: isRunning ? '#10b981' : '#fff',
                                fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer',
                                opacity: currentSeq?.isEnabled ? 1 : 0.4,
                                flexShrink: 0,
                                display: 'flex', alignItems: 'center', gap: '4px'
                                }}
                            >
                                {isRunning
                                ? <><span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', animation: 'pulse-green 1.4s infinite' }} /> Running</>
                                : <><Icon.Play /> 실행</>
                                }
                            </button>
                            );
                        })()}
                    </div>

                    <div onDragOver={(e) => e.preventDefault()} onDrop={handleDropOnBoard} style={{ flex: 1, borderRadius: '14px', background: draggingTool ? 'rgba(37, 99, 235, 0.03)' : 'rgba(128,128,128,0.01)', border: draggingTool ? '2px dashed #2563eb' : '1px dashed var(--border-glass-input)', padding: '12px', overflowY: 'auto', minHeight: 0 }}>
                      {steps.length === 0 ? (
                        <div style={{ display: 'flex', width: '100%', height: '100%', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                          <span style={{ margin: 'auto' }}>좌측 도구들을 이곳에 드롭하여 실행 파이프라인 그래프를 설계하세요.</span>
                        </div>
                      ) : (
                        <Reorder.Group axis="y" values={steps} onReorder={setSteps} style={{ display: 'flex', flexDirection: 'column', gap: '0px', listStyle: 'none', margin: 0, padding: 0 }}>
                          <AnimatePresence initial={false}>
                            {steps.map((step, index) => {
                              const isStepRunning = runningSequenceId === editingSequenceId && activeStepIndex === index;
                              const isStepPassed = runningSequenceId === editingSequenceId && activeStepIndex! > index;

                              return (
                                <React.Fragment key={step.id}>
                                  {index > 0 && (
                                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '22px', margin: '2px 0', flexShrink: 0 }}>
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isStepPassed || isStepRunning ? "#10b981" : "#2563eb"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'stroke 0.3s ease' }}><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                                    </div>
                                  )}
                                  
                                  <Reorder.Item 
                                    key={step.id} 
                                    value={step} 
                                    whileDrag={{ scale: 0.99 }} 
                                    style={{ 
                                      display: 'flex', flexDirection: 'column', gap: '6px', 
                                      background: 'var(--bg-glass-card)', 
                                      border: isStepRunning 
                                        ? '1.5px solid #10b981' 
                                        : isStepPassed 
                                          ? '1px solid rgba(16, 185, 129, 0.4)'
                                          : step.fullToolName === 'ai__ask_llm' 
                                            ? '1px solid rgba(37,99,235,0.3)' 
                                            : 'var(--border-glass)', 
                                      borderRadius: '12px', padding: '10px 14px', cursor: 'grab', 
                                      boxShadow: isStepRunning ? '0 0 15px rgba(16, 185, 129, 0.15)' : '0 2px 8px rgba(0,0,0,0.02)', 
                                      flexShrink: 0,
                                      transition: 'border-color 0.3s ease, box-shadow 0.3s ease'
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: isStepRunning ? '#10b981' : step.fullToolName === 'ai__ask_llm' ? '#2563eb' : 'var(--color-text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        
                                        {isStepRunning ? (
                                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', boxShadow: '0 0 6px #10b981', marginRight: '4px' }} className="pulse-active-dot" />
                                        ) : isStepPassed ? (
                                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', marginRight: '4px' }} />
                                        ) : null}

                                        {step.fullToolName === 'ai__ask_llm' ? <Icon.Cpu /> : <Icon.Activity />}
                                        [Node {index}] {step.fullToolName.includes('__') ? step.fullToolName.split('__')[1] : step.fullToolName}
                                        <span style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--color-text-muted)', marginLeft: '6px' }}>({step.pluginId})</span>
                                      </div>
                                      <button onClick={() => handleRemoveStep(step.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontWeight: 700, cursor: 'pointer', fontSize: '0.72rem', flexShrink: 0, display: 'flex', alignItems: 'center' }}><Icon.AlertCircle />삭제</button>
                                    </div>
                                    <textarea value={step.argsTemplate} onChange={e => handleStepArgsChange(step.id, e.target.value)} rows={2} style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border-glass-input)', background: 'var(--bg-input)', color: 'inherit', fontFamily: 'monospace', fontSize: '0.74rem', resize: 'none', outline: 'none', boxSizing: 'border-box', opacity: isStepRunning ? 1 : 0.8 }} />
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