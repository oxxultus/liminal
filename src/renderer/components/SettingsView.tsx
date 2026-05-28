// src/renderer/components/SettingsView.tsx
import React, { useState, useEffect, useRef } from 'react';
import { EngineConfig } from '../App';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

const Icon = {
  Plus: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Trash: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  ),
  Edit: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z"/>
    </svg>
  ),
  More: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
    </svg>
  ),
  Cpu: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="15" x2="23" y2="15"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="15" x2="4" y2="15"/>
    </svg>
  ),
  EmptySettings: () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-muted)', opacity: 0.5, marginBottom: '12px' }}>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  )
};

interface SettingsViewProps {
  engines: EngineConfig[];
  activeEngine: EngineConfig | null;
  onEngineChange: (id: string) => void;
  onSave: () => void;
}

export default function SettingsView({ engines = [], activeEngine, onEngineChange, onSave }: SettingsViewProps) {
  const [hoveredEngineId, setHoveredEngineId] = useState<string | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [menuOpenEngineId, setMenuOpenEngineId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState('');
  const [provider, setProvider] = useState<EngineConfig['provider']>('openai');
  const [url, setUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');

  const [targetEngineId, setTargetEngineId] = useState<string | null>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenEngineId(null);
      }
    };
    if (menuOpenEngineId) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [menuOpenEngineId]);

  const handleOpenMenu = (e: React.MouseEvent<HTMLButtonElement>, engineId: string) => {
    e.stopPropagation(); 
    if (menuOpenEngineId === engineId) {
      setMenuOpenEngineId(null);
    } else {
      setMenuOpenEngineId(engineId);
    }
  };

  const handleAddEngine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url || !model) return alert('필수 항목들을 기입해 주세요.');

    const newEngine: EngineConfig = { id: `eng-${Date.now()}`, name, provider, url, model, apiKey };
    await window.electronAPI.addEngine(newEngine); 
    onSave(); 
    resetForm();
  };

  const handleStartEditModal = (eng: EngineConfig) => {
    setTargetEngineId(eng.id);
    setName(eng.name);
    setProvider(eng.provider);
    setUrl(eng.url);
    setModel(eng.model);
    setApiKey(eng.apiKey);

    setIsEditModalOpen(true);
    setMenuOpenEngineId(null);
  };

  const handleSaveEditPopup = async () => {
    if (!targetEngineId || !name.trim() || !url.trim() || !model.trim()) return;

    const updatedEngine: EngineConfig = { id: targetEngineId, name: name.trim(), provider, url: url.trim(), model: model.trim(), apiKey };
    await window.electronAPI.addEngine(updatedEngine); 
    onSave();
    setIsEditModalOpen(false);
    setTargetEngineId(null);
    resetForm();
  };

  const handleRemoveEngine = async (id: string, engineName: string) => {
    setMenuOpenEngineId(null);
    if (!confirm(`[${engineName}] LLM 코어 엔진 명세를 삭제하시겠습니까?`)) return;
    await window.electronAPI.removeEngine(id); 
    onSave(); 
  };

  const resetForm = () => {
    setName(''); setProvider('openai'); setUrl(''); setModel(''); setApiKey('');
    setIsAddModalOpen(false);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '8px',
    border: '1px solid var(--border-glass-input)',
    backgroundColor: 'var(--bg-input)',
    color: 'var(--color-text-main)', fontWeight: 500, fontSize: '0.9rem', outline: 'none',
    marginTop: '6px', boxSizing: 'border-box'
  };

  const labelStyle: React.CSSProperties = { fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-muted)' };

  // 💡 [디자인 통일] PluginsView의 배지 규격과 100% 매칭되는 미니멀 배지 스타일 딕셔너리
  // 🟢 반환 타입을 React.CSSProperties로 명시하여 구조적 무결성 확보
  const getProviderBadgeStyle = (prov: string): React.CSSProperties => {
    const isAnthropic = prov === 'anthropic';
    const isGoogle = prov === 'google';
    
    return {
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
      boxSizing: 'border-box', // 💡 이제 컴파일러가 단순 string이 아닌 'border-box' 고정 규격으로 완벽히 인지합니다.
      letterSpacing: '0.02em',
      color: '#fff',
      backgroundColor: isAnthropic ? '#f59e0b' : isGoogle ? '#3b82f6' : '#10b981',
      boxShadow: isAnthropic 
        ? '0 2px 6px rgba(245,158,11,0.2)' 
        : isGoogle 
          ? '0 2px 6px rgba(59,130,246,0.2)' 
          : '0 2px 6px rgba(16,185,129,0.2)'
    };
  };

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', backgroundColor: 'transparent', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '840px', margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: '24px', boxSizing: 'border-box' }}>
        
        {/* 대시보드 상단 헤더 바 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid rgba(128,128,128,0.15)', paddingBottom: '16px' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0, letterSpacing: '-0.02em' }}>Customize Setup</h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>가동할 LLM 엔진 카드를 마우스로 클릭하여 즉시 활성화 상태로 지정하고 관리하세요.</p>
          </div>
          
          <button
            onClick={() => setIsAddModalOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px',
              background: 'var(--color-text-main)', color: 'var(--color-btn-text)', border: 'none', borderRadius: '10px',
              fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', transition: 'opacity 0.15s'
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            <Icon.Plus /> Add Engine
          </button>
        </div>

        {/* 등록된 AI 엔진 카드 리스트 그리드 세션 */}
        <section style={{ marginTop: '4px' }}>
          {engines.length === 0 ? (
            <div style={{ 
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '60px 20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem', fontWeight: 500,
              background: 'var(--bg-glass-card)', borderRadius: '16px', border: 'var(--border-glass)'
            }}>
              <Icon.EmptySettings />
              등록된 LLM 명세 파일이 없습니다. 우측 상단의 Add Engine 버튼을 눌러 연동 설정을 등록하세요.
            </div>
          ) : (
            <motion.div 
              layout
              style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px', width: '100%' }}
            >
              <AnimatePresence mode="popLayout">
                {engines.map((eng) => {
                  const isActive = activeEngine?.id === eng.id;
                  
                  return (
                    <motion.div 
                      key={eng.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                      onMouseEnter={() => setHoveredEngineId(eng.id)}
                      onMouseLeave={() => setHoveredEngineId(null)}
                      onClick={() => onEngineChange(eng.id)}
                      style={{
                        background: isActive ? 'rgba(16, 185, 129, 0.04)' : 'var(--bg-glass-card)', 
                        border: isActive ? '1px solid #10b981' : 'var(--border-glass)',
                        borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column',
                        gap: '12px', 
                        boxShadow: isActive ? '0 6px 20px rgba(16, 185, 129, 0.08)' : '0 4px 16px rgba(0,0,0,0.01)', 
                        position: 'relative', height: '135px', boxSizing: 'border-box',
                        width: '100%', minWidth: 0,
                        cursor: 'pointer',
                        transition: 'border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', maxWidth: '65%', flexWrap: 'nowrap' }}>
                          <span style={{ color: isActive ? '#10b981' : 'var(--color-text-muted)', opacity: 0.8, display: 'flex', alignItems: 'center' }}>
                            <Icon.Cpu />
                          </span>

                          {/* 💡 [변경 1] ACTIVE 문자열 배지를 걷어내고, PluginsView와 일치하는 정밀 캡슐 그린닷(🟢) 연출 이식 */}
                          {isActive && (
                            <span style={{
                              width: '6px', height: '6px', borderRadius: '50%',
                              backgroundColor: '#10b981', flexShrink: 0,
                              boxShadow: '0 0 6px #10b981'
                            }} />
                          )}

                          <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text-main)' }}>
                            {eng.name}
                          </span>
                        </div>
                        
                        {/* 💡 [변경 2] 우측 배지 공간은 순수하게 규격화된 Provider 정보만 우아하게 마킹 */}
                        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                          <span style={getProviderBadgeStyle(eng.provider)}>
                            {eng.provider}
                          </span>
                        </div>
                      </div>

                      <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Model Spec Identifier</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--color-text-main)', fontFamily: 'monospace', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {eng.model}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(128,128,128,0.1)', paddingTop: '8px' }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%', fontFamily: 'monospace' }}>
                          {eng.url}
                        </div>
                      </div>

                      {/* 더보기 버튼 */}
                      {(hoveredEngineId === eng.id || menuOpenEngineId === eng.id) && (
                        <button
                          onClick={(e) => handleOpenMenu(e, eng.id)}
                          style={{
                            position: 'absolute', bottom: '12px', right: '14px',
                            background: 'transparent', border: 'none',
                            color: menuOpenEngineId === eng.id ? 'var(--color-text-main)' : 'var(--color-text-muted)', 
                            cursor: 'pointer', padding: '4px', borderRadius: '4px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10
                          }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(128,128,128,0.08)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <Icon.More />
                        </button>
                      )}

                      {menuOpenEngineId === eng.id && (
                        <div
                          ref={menuRef}
                          style={{
                            position: 'absolute', bottom: '38px', right: '14px',
                            backgroundColor: 'var(--bg-bubble-bot)', backdropFilter: 'blur(20px)',
                            border: 'var(--border-glass)', borderRadius: '10px',
                            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)', padding: '4px', zIndex: 9999,
                            display: 'flex', flexDirection: 'column', gap: '1px', width: '120px',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => handleStartEditModal(eng)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px',
                              border: 'none', background: 'transparent', borderRadius: '6px',
                              fontSize: '0.78rem', fontWeight: 500, color: 'var(--color-text-main)', cursor: 'pointer',
                              textAlign: 'left', width: '100%'
                            }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(128,128,128,0.08)')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <Icon.Edit /> 엔진 정보 수정
                          </button>
                          <button
                            onClick={() => handleRemoveEngine(eng.id, eng.name)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px',
                              border: 'none', background: 'transparent', borderRadius: '6px',
                              fontSize: '0.78rem', fontWeight: 500, color: '#ef4444', cursor: 'pointer',
                              textAlign: 'left', width: '100%'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)'; }}
                            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                          >
                            <Icon.Trash /> 삭제하기
                          </button>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </section>

        {/* ── 💡 팝업 1: AI 엔진 명세 생성 추가 신규 모달 레이어 (Portal 및 가드가 완비된 와이드 캡슐) ── */}
        {typeof document !== 'undefined' && createPortal(
          <AnimatePresence>
            {isAddModalOpen && (
              <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(20px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999
              }} onClick={resetForm}>
                <motion.div 
                  initial={{ opacity: 0, scale: 0.96, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 15 }}
                  transition={{ type: 'spring', duration: 0.35 }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: '88vw', maxWidth: '460px', height: 'auto', maxHeight: '85vh',
                    background: 'var(--bg-modal)', border: 'var(--border-glass)', 
                    boxShadow: '0 30px 80px rgba(0, 0, 0, 0.4)', borderRadius: '20px',
                    display: 'flex', flexDirection: 'column', padding: '24px', boxSizing: 'border-box', gap: '16px',
                    overflowY: 'auto'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#2563eb', display: 'flex' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="24"/><line x1="15" y1="20" x2="15" y2="24"/><line x1="20" y1="9" x2="24" y2="9"/><line x1="20" y1="15" x2="24" y2="15"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="15" x2="4" y2="15"/></svg>
                      </span>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text-main)' }}>AI 코어 엔진 등록</div>
                    </div>
                    <button onClick={resetForm} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  <p style={{ margin: '0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>가동할 인공지능 명세 주소와 식별자를 연동 마운트합니다.</p>

                  <form onSubmit={handleAddEngine} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div>
                        <div style={labelStyle}>Provider</div>
                        <select value={provider} onChange={(e) => setProvider(e.target.value as any)} style={inputStyle}>
                          <option value="openai" style={{ background: 'var(--bg-input)' }}>OpenAI</option>
                          <option value="anthropic" style={{ background: 'var(--bg-input)' }}>Anthropic</option>
                          <option value="google" style={{ background: 'var(--bg-input)' }}>Google</option>
                        </select>
                      </div>
                      <div>
                        <div style={labelStyle}>Engine Name</div>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="예: GPT-4o" required style={inputStyle} />
                      </div>
                    </div>

                    <div>
                      <div style={labelStyle}>Endpoint Base URL</div>
                      <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://api.openai.com/v1" required style={inputStyle} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                      <div>
                        <div style={labelStyle}>Model Identifier</div>
                        <input type="text" value={model} onChange={e => setModel(e.target.value)} placeholder="예: gpt-4o" required style={inputStyle} />
                      </div>
                      <div>
                        <div style={labelStyle}>Secret API Key</div>
                        <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-..." style={inputStyle} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                      <button type="button" onClick={resetForm} style={{ padding: '9px 16px', border: 'none', background: 'rgba(128,128,128,0.1)', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                        취소
                      </button>
                      <button type="submit" style={{ padding: '9px 16px', border: 'none', background: 'var(--color-text-main)', color: 'var(--color-btn-text)', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                        Activate Engine
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

        {/* ── 💡 팝업 2: 등록된 기존 AI 엔진 통합 수정 모달 레이어 (Portal 및 가드가 완비된 와이드 캡슐) ── */}
        {typeof document !== 'undefined' && createPortal(
          <AnimatePresence>
            {isEditModalOpen && (
              <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                width: '100vw', height: '100vh', backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(20px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999
              }} onClick={() => { setIsEditModalOpen(false); setTargetEngineId(null); }}>
                <motion.div 
                  initial={{ opacity: 0, scale: 0.96, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 15 }}
                  transition={{ type: 'spring', duration: 0.35 }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    width: '88vw', maxWidth: '420px', height: 'auto', maxHeight: '85vh',
                    background: 'var(--bg-modal)', border: 'var(--border-glass)', 
                    boxShadow: '0 30px 80px rgba(0, 0, 0, 0.4)', borderRadius: '20px',
                    display: 'flex', flexDirection: 'column', padding: '24px', boxSizing: 'border-box', gap: '14px',
                    overflowY: 'auto'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#2563eb', display: 'flex' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z"/></svg>
                      </span>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text-main)' }}>엔진 설정 명세 수정</div>
                    </div>
                    <button onClick={() => { setIsEditModalOpen(false); setTargetEngineId(null); }} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                  <p style={{ margin: '0', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>해당 코어 인공지능의 연동 명세 구조를 재정비합니다.</p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <div style={labelStyle}>Provider</div>
                      <select value={provider} onChange={(e) => setProvider(e.target.value as any)} style={inputStyle}>
                        <option value="openai" style={{ background: 'var(--bg-input)' }}>OpenAI</option>
                        <option value="anthropic" style={{ background: 'var(--bg-input)' }}>Anthropic</option>
                        <option value="google" style={{ background: 'var(--bg-input)' }}>Google</option>
                      </select>
                    </div>
                    <div>
                      <div style={labelStyle}>Engine Name</div>
                      <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="엔진 표시명" required style={inputStyle} />
                    </div>
                  </div>

                  <div>
                    <div style={labelStyle}>Endpoint Base URL</div>
                    <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="엔드포인트 API 주소" required style={inputStyle} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <div style={labelStyle}>Model Identifier</div>
                      <input type="text" value={model} onChange={e => setModel(e.target.value)} placeholder="모델 식별 코드명" required style={inputStyle} />
                    </div>
                    <div>
                      <div style={labelStyle}>Secret API Key</div>
                      <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-..." style={inputStyle} />
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                    <button
                      type="button"
                      onClick={() => { setIsEditModalOpen(false); setTargetEngineId(null); }}
                      style={{ padding: '8px 14px', border: 'none', background: 'rgba(128,128,128,0.1)', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-muted)', cursor: 'pointer' }}
                    >취소</button>
                    <button
                      type="button"
                      onClick={handleSaveEditPopup}
                      disabled={!name.trim() || !url.trim() || !model.trim()}
                      style={{ 
                        padding: '8px 14px', border: 'none', background: 'var(--color-text-main)', color: 'var(--color-btn-text)', borderRadius: '6px', 
                        fontSize: '0.82rem', fontWeight: 600, 
                        cursor: (name.trim() && url.trim() && model.trim()) ? 'pointer' : 'not-allowed', 
                        opacity: (name.trim() && url.trim() && model.trim()) ? 1 : 0.5 
                      }}
                    >저장</button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      </div>
    </div>
  );
}