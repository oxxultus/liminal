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
  // 새 엔진 추가를 위한 상태
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<EngineConfig['provider']>('openai');
  const [url, setUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');

  const handleAddEngine = async () => {
    if (!name || !url) return alert('필수 항목을 입력하세요.');
    const newEngine: EngineConfig = { id: `eng-${Date.now()}`, name, provider, url, model, apiKey };
    
    await window.electronAPI.addEngine(newEngine); // 메인 프로세스에 추가 요청
    onSave(); // 리스트 새로고침
    setName(''); setUrl(''); setModel(''); setApiKey('');
  };

  const handleRemoveEngine = async (id: string) => {
    if (engines.length <= 1) return alert('최소 하나의 엔진은 필요합니다.');
    await window.electronAPI.removeEngine(id); // 메인 프로세스에 삭제 요청
    onSave(); // 리스트 새로고침
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #334155',
    backgroundColor: '#0f172a', color: '#fff', fontSize: '0.9rem', marginTop: '4px'
  };

  return (
    <div style={{ width: '100%', padding: '40px 24px', overflowY: 'auto' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '30px' }}>
        
        {/* 기존: 엔진 선택 섹션 */}
        <section style={{ backgroundColor: 'rgba(13, 27, 62, 0.3)', padding: '28px', borderRadius: '16px', border: '1px solid #1e293b' }}>
          <h2 style={{ color: '#fff' }}>Core Engine Selection</h2>
          <select value={activeEngine.id} onChange={(e) => onEngineChange(e.target.value)} style={inputStyle}>
            {engines.map(eng => <option key={eng.id} value={eng.id}>{eng.name}</option>)}
          </select>
        </section>

        {/* 신규: 엔진 관리 섹션 */}
        <section style={{ backgroundColor: 'rgba(13, 27, 62, 0.3)', padding: '28px', borderRadius: '16px', border: '1px solid #1e293b' }}>
          <h2 style={{ color: '#fff', marginBottom: '20px' }}>Manage Engines</h2>
          
          {/* 추가 폼 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
            <input placeholder="이름" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
            <select value={provider} onChange={e => setProvider(e.target.value as any)} style={inputStyle}>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google</option>
            </select>
            <input placeholder="API URL" value={url} onChange={e => setUrl(e.target.value)} style={inputStyle} />
            <input placeholder="모델명 (예: gpt-4o)" value={model} onChange={e => setModel(e.target.value)} style={inputStyle} />
            <input type="password" placeholder="API Key" value={apiKey} onChange={e => setApiKey(e.target.value)} style={inputStyle} />
            <button onClick={handleAddEngine} style={{ background: '#06b6d4', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Add Engine</button>
          </div>

          {/* 삭제 리스트 */}
          <div style={{ borderTop: '1px solid #334155', paddingTop: '20px' }}>
            {engines.map(eng => (
              <div key={eng.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', color: '#fff' }}>
                <span>{eng.name}</span>
                <button onClick={() => handleRemoveEngine(eng.id)} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}