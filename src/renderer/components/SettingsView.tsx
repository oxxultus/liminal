// src/renderer/components/SettingsView.tsx
import React, { useState } from 'react';
import { EngineConfig } from '../App';

interface SettingsViewProps {
  engines: EngineConfig[];
  activeEngine: EngineConfig;
  onEngineChange: (id: string) => void;
  onSave: () => void;
}

export default function SettingsView({ engines, activeEngine, onEngineChange, onSave }: SettingsViewProps) {
  // 새 엔진 추가를 위한 상태들
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<EngineConfig['provider']>('openai');
  const [url, setUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');

  // 엔진 추가 요청 제어 (State 바인딩 복구)
  const handleAddEngine = async () => {
    if (!name || !url) return alert('필수 항목을 입력하세요.');
    const newEngine: EngineConfig = { id: `eng-${Date.now()}`, name, provider, url, model, apiKey };
    
    await window.electronAPI.addEngine(newEngine); // 메인 프로세스에 추가 요청
    onSave(); // 리스트 새로고침
    setName(''); setUrl(''); setModel(''); setApiKey('');
  };

  // 엔진 삭제 제어
  const handleRemoveEngine = async (id: string) => {
    if (engines.length <= 1) return alert('최소 하나의 엔진은 필요합니다.');
    if (!confirm('해당 LLM 엔진 명세를 삭제하시겠습니까?')) return;
    await window.electronAPI.removeEngine(id); // 메인 프로세스에 삭제 요청
    onSave(); // 리스트 새로고침
  };

  // 🤍 화이트 글래스모피즘 아크릴 카드 스타일
  const glassCardStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.2) 100%)',
    backdropFilter: 'blur(30px)',
    WebkitBackdropFilter: 'blur(30px)',
    padding: '28px',
    borderRadius: '16px',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.04)',
  };

  // 🤍 고대비 라이트 모드 입력 폼 스타일
  const inputStyle: React.CSSProperties = {
    width: '100%', 
    padding: '12px', 
    borderRadius: '10px', 
    border: '1px solid rgba(0, 0, 0, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.75)', 
    color: '#111111', 
    fontWeight: 500,
    fontSize: '0.92rem', 
    marginTop: '4px',
    boxSizing: 'border-box',
    outline: 'none',
    boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.02)'
  };

  const labelStyle: React.CSSProperties = { fontSize: '0.85rem', fontWeight: 700, color: '#4E4E5A' };

  return (
    <div style={{ width: '100%', height: '100%', padding: '40px 24px', overflowY: 'auto', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '30px' }}>
        
        {/* 기존: 엔진 선택 섹션 */}
        <section style={glassCardStyle}>
          <h2 style={{ color: '#2D2D35', fontSize: '1.2rem', fontWeight: 700, marginTop: 0, marginBottom: '16px' }}>Core Engine Selection</h2>
          <select value={activeEngine.id} onChange={(e) => onEngineChange(e.target.value)} style={inputStyle}>
            {engines.map(eng => (
              <option key={eng.id} value={eng.id} style={{ backgroundColor: '#F4F4F6', color: '#111' }}>
                {eng.name} ({eng.model})
              </option>
            ))}
          </select>
        </section>

        {/* 신규: 엔진 관리 섹션 */}
        <section style={glassCardStyle}>
          <h2 style={{ color: '#2D2D35', fontSize: '1.2rem', fontWeight: 700, marginTop: 0, marginBottom: '20px' }}>Manage Engines</h2>
          
          {/* 추가 폼 (value, onChange 상태 바인딩 완전 패치) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '24px' }}>
            <div>
              <div style={labelStyle}>Engine Name</div>
              <input placeholder="예: Claude 3.5 Sonnet" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Provider</div>
              <select value={provider} onChange={e => setProvider(e.target.value as any)} style={inputStyle}>
                <option value="openai" style={{ backgroundColor: '#F4F4F6', color: '#111' }}>OpenAI</option>
                <option value="anthropic" style={{ backgroundColor: '#F4F4F6', color: '#111' }}>Anthropic</option>
                <option value="google" style={{ backgroundColor: '#F4F4F6', color: '#111' }}>Google</option>
              </select>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <div style={labelStyle}>Endpoint Base URL</div>
              <input placeholder="https://api.openai.com/v1/chat/completions" value={url} onChange={e => setUrl(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Model Identifier</div>
              <input placeholder="예: claude-3-5-sonnet-20241022" value={model} onChange={e => setModel(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={labelStyle}>Secret API Key</div>
              <input type="password" placeholder="sk-..." value={apiKey} onChange={e => setApiKey(e.target.value)} style={inputStyle} />
            </div>
            
            <button 
              onClick={handleAddEngine} 
              style={{ 
                gridColumn: 'span 2',
                padding: '12px', 
                background: '#2D2D35', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '10px', 
                cursor: 'pointer',
                fontSize: '0.92rem',
                fontWeight: 700,
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                marginTop: '12px',
                transition: 'background 0.2s'
              }}
            >
              Add New Engine Spec
            </button>
          </div>

          {/* 💡 삭제 가능한 등록된 엔진 목록 데이터 필드 복구 */}
          <div style={{ borderTop: '1px solid rgba(0, 0, 0, 0.08)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ ...labelStyle, marginBottom: '4px' }}>Registered Engines Spec ({engines.length})</div>
            {engines.map(eng => (
              <div 
                key={eng.id} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  padding: '12px 16px', 
                  color: '#111111',
                  backgroundColor: 'rgba(255, 255, 255, 0.5)',
                  border: '1px solid rgba(0, 0, 0, 0.05)',
                  borderRadius: '10px',
                  fontWeight: 500,
                  fontSize: '0.92rem'
                }}
              >
                <div>
                  <span style={{ fontWeight: 700, color: '#2D2D35' }}>{eng.name}</span>
                  <span style={{ fontSize: '0.8rem', color: '#6E6E7A', marginLeft: '8px', fontFamily: 'monospace' }}>[{eng.provider.toUpperCase()} / {eng.model}]</span>
                </div>
                <button 
                  onClick={() => handleRemoveEngine(eng.id)} 
                  style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}