// src/renderer/components/SettingsView.tsx
import React, { useState, useEffect, useRef } from 'react';
import { EngineConfig } from '../App';

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

  // 모달 제어 상태 스위치
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // 더보기 컨텍스트 메뉴용 제어 상태
  const [menuOpenEngineId, setMenuOpenEngineId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 폼 입력 및 수정 버퍼 유닛 상태
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<EngineConfig['provider']>('openai');
  const [url, setUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');

  // 수정할 대상 엔진 타겟팅 포인터
  const [targetEngineId, setTargetEngineId] = useState<string | null>(null);

  // 외부 영역 클릭 시 컨텍스트 메뉴 닫기 유틸리티
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenEngineId(null);
      }
    };
    if (menuOpenEngineId) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [menuOpenEngineId]);

  // 더보기 메뉴 열기 제어
  const handleOpenMenu = (e: React.MouseEvent, engineId: string) => {
    e.stopPropagation();
    if (menuOpenEngineId === engineId) {
      setMenuOpenEngineId(null);
    } else {
      setMenuOpenEngineId(engineId);
    }
  };

  // 엔진 등록 처리 함수
  const handleAddEngine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !url || !model) return alert('필수 항목들을 기입해 주세요.');

    const newEngine: EngineConfig = { id: `eng-${Date.now()}`, name, provider, url, model, apiKey };
    await window.electronAPI.addEngine(newEngine); 
    onSave(); 
    resetForm();
  };

  // 수정 팝업 진입 전처리 및 데이터 로드
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

  // 수정한 엔진 명세 업데이트 완료 함수
  const handleSaveEditPopup = async () => {
    if (!targetEngineId || !name.trim() || !url.trim() || !model.trim()) return;

    const updatedEngine: EngineConfig = { id: targetEngineId, name: name.trim(), provider, url: url.trim(), model: model.trim(), apiKey };
    await window.electronAPI.addEngine(updatedEngine); // SQLite UPSERT 명세 연동
    onSave();
    setIsEditModalOpen(false);
    setTargetEngineId(null);
    resetForm();
  };

  // 엔진 삭제 처리
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

  // 공용 글래스 스타일 묶음
  const glassCardStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.2) 100%)',
    backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
    padding: '28px', borderRadius: '16px', border: '1px solid rgba(0, 0, 0, 0.08)',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.04)', boxSizing: 'border-box'
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '8px',
    border: '1px solid rgba(0, 0, 0, 0.12)', backgroundColor: '#FFFFFF',
    color: '#111111', fontWeight: 500, fontSize: '0.9rem', outline: 'none',
    marginTop: '6px', boxSizing: 'border-box'
  };

  const labelStyle: React.CSSProperties = { fontSize: '0.82rem', fontWeight: 700, color: '#4E4E5A' };

  // 각 Provider 명칭별 뱃지 스타일 맵핑 함수
  const getProviderBadgeStyle = (prov: string) => {
    const isAnthropic = prov === 'anthropic';
    const isGoogle = prov === 'google';
    return {
      fontSize: '0.68rem', padding: '3px 8px', borderRadius: '6px', fontWeight: 800, textTransform: 'uppercase' as const,
      backgroundColor: isAnthropic ? 'rgba(217, 119, 6, 0.08)' : isGoogle ? 'rgba(0, 102, 204, 0.08)' : 'rgba(0, 0, 0, 0.04)',
      border: isAnthropic ? '1px solid rgba(217, 119, 6, 0.15)' : isGoogle ? '1px solid rgba(0, 102, 204, 0.15)' : '1px solid rgba(0, 0, 0, 0.05)',
      color: isAnthropic ? '#d97706' : isGoogle ? '#0066cc' : '#2D2D35'
    };
  };

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', backgroundColor: 'transparent', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '840px', margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: '24px', boxSizing: 'border-box' }}>
        
        {/* 대시보드 상단 헤더 바 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: '16px' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#2D2D35', margin: 0, letterSpacing: '-0.02em' }}>Customize Setup</h1>
            <p style={{ fontSize: '0.85rem', color: '#6E6E7A', margin: '4px 0 0 0' }}>추가 연동을 위한 대형 언어 모델 명세 관리 및 기본 코어 구동 엔진 세팅</p>
          </div>
          
          {/* 팝업 액션 버튼 조화 구성 */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px',
              background: '#2D2D35', color: '#FFFFFF', border: 'none', borderRadius: '10px',
              fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', transition: 'background-color 0.15s',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
            }}
          >
            <Icon.Plus /> Add Engine
          </button>
        </div>

        {/* 1. 활성화 코어 엔진 기본 선택 카드 */}
        <section style={glassCardStyle}>
          <h2 style={{ color: '#2D2D35', fontSize: '1.1rem', fontWeight: 800, marginTop: 0, marginBottom: '4px', letterSpacing: '-0.01em' }}>Core Engine Selection</h2>
          <p style={{ fontSize: '0.8rem', color: '#6E6E7A', marginBottom: '16px' }}>클라이언트 작업 공간의 메인 브레인 역할을 수행할 대표 인공지능을 정합니다.</p>
          
          {engines.length === 0 ? (
            <div style={{ padding: '14px', backgroundColor: 'rgba(220, 38, 38, 0.06)', border: '1px solid rgba(220, 38, 38, 0.15)', color: '#dc2626', borderRadius: '10px', fontSize: '0.88rem', fontWeight: 600 }}>
              ⚠️ 등록된 LLM 엔진 명세가 전혀 없습니다! 아래 Add Engine 버튼을 통해 최소 1개 이상 추가해야 워크스페이스가 가동됩니다.
            </div>
          ) : (
            <select 
              value={activeEngine?.id || ''} 
              onChange={(e) => onEngineChange(e.target.value)} 
              style={{ ...inputStyle, padding: '12px', border: '1px solid rgba(0, 0, 0, 0.15)', backgroundColor: 'rgba(255, 255, 255, 0.85)', fontSize: '0.95rem' }}
            >
              {!activeEngine && <option value="">--- 가동할 코어 엔진을 선택해 주세요 ---</option>}
              {engines.map(eng => (
                <option key={eng.id} value={eng.id} style={{ backgroundColor: '#F4F4F6', color: '#111' }}>
                  {eng.name} — [{eng.provider.toUpperCase()} / {eng.model}]
                </option>
              ))}
            </select>
          )}
        </section>

        {/* 2. 등록된 AI 엔진 카드 리스트 그리드 세션 */}
        <section style={{ marginTop: '8px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '16px', color: '#2D2D35', marginTop: 0 }}>Registered Engine Specs ({engines.length})</h2>
          
          {engines.length === 0 ? (
            <div style={{ 
              padding: '60px 20px', textAlign: 'center', color: '#6E6E7A', fontSize: '0.9rem', fontWeight: 500,
              background: 'rgba(255,255,255,0.4)', borderRadius: '16px', border: '1px solid rgba(0,0,0,0.05)', backdropFilter: 'blur(20px)'
            }}>
              ⚙️ 등록된 LLM 명세 파일이 없습니다. 우측 상단의 Add Engine 버튼을 눌러 연동 설정을 등록하세요.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {engines.map((eng) => (
                <div 
                  key={eng.id}
                  onMouseEnter={() => setHoveredEngineId(eng.id)}
                  onMouseLeave={() => setHoveredEngineId(null)}
                  style={{
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.65) 0%, rgba(255, 255, 255, 0.4) 100%)',
                    backdropFilter: 'blur(20px)', border: '1px solid rgba(0, 0, 0, 0.08)',
                    borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column',
                    gap: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.02)', position: 'relative',
                    height: '135px', boxSizing: 'border-box'
                  }}
                >
                  {/* 상단 명칭 및 종류 라벨 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '70%' }}>
                      <span style={{ color: '#4E4E5A', opacity: 0.8, display: 'flex', alignItems: 'center' }}><Icon.Cpu /></span>
                      <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: 700, fontSize: '0.95rem', color: '#2D2D35' }}>{eng.name}</span>
                    </div>
                    <span style={getProviderBadgeStyle(eng.provider)}>
                      {eng.provider}
                    </span>
                  </div>

                  {/* 중단 라우팅 엔드포인트 세부 식별문자열 */}
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9E9EAF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Model Spec Identifier</div>
                    <div style={{ fontSize: '0.82rem', color: '#4E4E5A', fontFamily: 'monospace', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {eng.model}
                    </div>
                  </div>

                  {/* 하단 단독 락업형 내장 자석 컨텍스트 메뉴 단추 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '8px' }}>
                    <div style={{ fontSize: '0.78rem', color: '#6E6E7A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%', fontFamily: 'monospace' }}>
                      {eng.url}
                    </div>
                  </div>

                  {/* 카드 내장 더보기 자석 버튼 구성 */}
                  {(hoveredEngineId === eng.id || menuOpenEngineId === eng.id) && (
                    <button
                      onClick={(e) => handleOpenMenu(e, eng.id)}
                      style={{
                        position: 'absolute', bottom: '12px', right: '14px',
                        background: 'transparent', border: 'none',
                        color: menuOpenEngineId === eng.id ? '#2D2D35' : '#9E9EAF', 
                        cursor: 'pointer', padding: '4px', borderRadius: '4px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <Icon.More />
                    </button>
                  )}

                  {/* 카드 내부 완전 수직 귀속 absolute 드롭다운 상자 장착 */}
                  {menuOpenEngineId === eng.id && (
                    <div
                      ref={menuRef}
                      style={{
                        position: 'absolute', bottom: '38px', right: '14px',
                        backgroundColor: 'rgba(255, 255, 255, 0.98)', backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(0, 0, 0, 0.12)', borderRadius: '10px',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)', padding: '4px', zIndex: 9999,
                        display: 'flex', flexDirection: 'column', gap: '1px', width: '120px',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => handleStartEditModal(eng)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px',
                          border: 'none', background: 'transparent', borderRadius: '6px',
                          fontSize: '0.78rem', fontWeight: 500, color: '#2D2D35', cursor: 'pointer',
                          textAlign: 'left', width: '100%'
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.04)')}
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
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── 팝업 1: AI 엔진 명세 생성 추가 신규 모달 레이어 ── */}
        {isAddModalOpen && (
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.15)', backdropFilter: 'blur(15px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000
          }} onClick={resetForm}>
            <div style={{
              width: '460px', padding: '24px', borderRadius: '18px',
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(245, 245, 250, 0.95) 100%)',
              border: '1px solid rgba(0, 0, 0, 0.12)', boxShadow: '0 25px 60px rgba(0, 0, 0, 0.18)',
              display: 'flex', flexDirection: 'column', gap: '16px'
            }} onClick={e => e.stopPropagation()}>
              
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#2D2D35' }}>AI 코어 엔진 등록</div>
                <p style={{ fontSize: '0.8rem', color: '#6E6E7A', margin: '4px 0 0 0' }}>가동할 인공지능 명세 주소와 식별자를 연동 마운트합니다.</p>
              </div>

              <form onSubmit={handleAddEngine} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <div style={labelStyle}>Provider</div>
                    <select value={provider} onChange={(e) => setProvider(e.target.value as any)} style={inputStyle}>
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="google">Google</option>
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
                  <button type="button" onClick={resetForm} style={{ padding: '9px 16px', border: 'none', background: 'rgba(0,0,0,0.05)', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, color: '#6E6E7A', cursor: 'pointer' }}>
                    취소
                  </button>
                  <button type="submit" style={{ padding: '9px 16px', border: 'none', background: '#2D2D35', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, color: '#FFFFFF', cursor: 'pointer' }}>
                    Activate Engine
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── 팝업 2: 등록된 기존 AI 엔진 통합 수정 모달 레이어 ── */}
        {isEditModalOpen && (
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.15)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000
          }} onClick={() => { setIsEditModalOpen(false); setTargetEngineId(null); }}>
            <div style={{
              width: '420px', padding: '24px', borderRadius: '16px',
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(245, 245, 250, 0.95) 100%)',
              border: '1px solid rgba(0, 0, 0, 0.15)', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.15)',
              display: 'flex', flexDirection: 'column', gap: '14px'
            }} onClick={e => e.stopPropagation()}>
              
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#2D2D35' }}>엔진 설정 명세 수정</div>
                <p style={{ fontSize: '0.78rem', color: '#6E6E7A', margin: '4px 0 0 0' }}>해당 코어 인공지능의 연동 명세 구조를 재정비합니다.</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <div style={labelStyle}>Provider</div>
                  <select value={provider} onChange={(e) => setProvider(e.target.value as any)} style={inputStyle}>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="google">Google</option>
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
              
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => { setIsEditModalOpen(false); setTargetEngineId(null); }}
                  style={{ padding: '8px 14px', border: 'none', background: 'rgba(0,0,0,0.05)', borderRadius: '6px', fontSize: '#0.82rem', fontWeight: 600, color: '#6E6E7A', cursor: 'pointer' }}
                >취소</button>
                <button
                  type="button"
                  onClick={handleSaveEditPopup}
                  disabled={!name.trim() || !url.trim() || !model.trim()}
                  style={{ 
                    padding: '8px 14px', border: 'none', background: '#2D2D35', borderRadius: '6px', 
                    fontSize: '0.82rem', fontWeight: 600, color: '#FFFFFF', 
                    cursor: (name.trim() && url.trim() && model.trim()) ? 'pointer' : 'not-allowed', 
                    opacity: (name.trim() && url.trim() && model.trim()) ? 1 : 0.5 
                  }}
                >저장</button>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}