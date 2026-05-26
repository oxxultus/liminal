// src/renderer/components/PluginsView.tsx
import React, { useState, useEffect } from 'react';

export default function PluginsView() {
  const [pluginType, setPluginType] = useState<'remote' | 'local'>('remote');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [workspaceDir, setWorkspaceDir] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [installedPlugins, setInstalledPlugins] = useState<any[]>([]);

  // 디바이스에 등록된 전체 MCP 플러그인 리스트 갱신
  const refreshPluginsList = async () => {
    const list = await window.electronAPI.getMcpPluginsList();
    setInstalledPlugins(list || []);
  };

  useEffect(() => {
    refreshPluginsList();
  }, []);

  // 플러그인 동적 등록 핸들러 (State 연동 완전 복구)
  const handleAddPlugin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg('초기화 중...');
    
    const config = {
      id: `plugin-${Date.now()}`,
      type: pluginType,
      name,
      enabled: true,
      ...(pluginType === 'remote' ? { url, apiKey } : { workspaceDir })
    };
    
    try {
      const res = await window.electronAPI.addMcpPlugin(config);
      if (res.success) {
        setName(''); 
        setUrl(''); 
        setApiKey(''); 
        setWorkspaceDir('');
        setStatusMsg('성공적으로 추가되었습니다.');
        refreshPluginsList();
      } else {
        setStatusMsg(`오류: ${res.error}`);
      }
    } catch (err: any) {
      setStatusMsg(`시스템 오류: ${err.message}`);
    }
  };

  // 플러그인 삭제 제어
  const handleRemovePlugin = async (id: string, pluginName: string) => {
    if (!confirm(`[${pluginName}] 플러그인을 삭제하시겠습니까?`)) return;
    const res = await window.electronAPI.removeMcpPlugin(id);
    if (res.success) refreshPluginsList();
  };

  // 🤍 화이트 글래스모피즘 아크릴 카드 공통 스타일
  const glassCardStyle: React.CSSProperties = {
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.2) 100%)',
    backdropFilter: 'blur(30px)',
    WebkitBackdropFilter: 'blur(30px)',
    padding: '28px',
    borderRadius: '16px',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.04)',
    boxSizing: 'border-box'
  };

  // 🤍 고대비 입력 폼 필드 스타일
  const inputStyle: React.CSSProperties = {
    width: '100%', 
    padding: '12px', 
    borderRadius: '10px', 
    border: '1px solid rgba(0, 0, 0, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.75)', 
    color: '#111111', 
    fontWeight: 500,
    fontSize: '0.92rem', 
    outline: 'none', 
    marginTop: '8px', 
    boxSizing: 'border-box',
    boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.02)'
  };

  const labelStyle: React.CSSProperties = { fontSize: '0.85rem', fontWeight: 700, color: '#4E4E5A' };

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', backgroundColor: 'transparent', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: '40px', boxSizing: 'border-box' }}>
        
        {/* 1. MCP 플러그인 추가 섹션 */}
        <section style={glassCardStyle}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '4px', color: '#2D2D35', marginTop: 0 }}>Add MCP Plugin</h2>
          <p style={{ fontSize: '0.85rem', color: '#6E6E7A', marginBottom: '24px' }}>새로운 자원 조작 플러그인을 에코시스템에 마운트합니다.</p>
          
          <form onSubmit={handleAddPlugin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <div style={labelStyle}>Plugin Type</div>
                <select value={pluginType} onChange={(e) => setPluginType(e.target.value as 'remote' | 'local')} style={inputStyle}>
                  <option value="remote" style={{ backgroundColor: '#F4F4F6', color: '#111' }}>Remote (FastAPI)</option>
                  <option value="local" style={{ backgroundColor: '#F4F4F6', color: '#111' }}>Local Workspace</option>
                </select>
              </div>
              <div>
                <div style={labelStyle}>Plugin Alias</div>
                {/* 💡 value 및 onChange 완전 복구 */}
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="별칭 입력" required style={inputStyle} />
              </div>
            </div>

            {/* 💡 타입별 조건부 입력 화면 제어 및 바인딩 완벽 복구 */}
            {pluginType === 'remote' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <div style={labelStyle}>Endpoint URL</div>
                  <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="http://..." required style={inputStyle} />
                </div>
                <div>
                  <div style={labelStyle}>Security Token</div>
                  <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="API Key" required style={inputStyle} />
                </div>
              </div>
            ) : (
              <div>
                <div style={labelStyle}>Absolute Workspace Path</div>
                <input type="text" value={workspaceDir} onChange={e => setWorkspaceDir(e.target.value)} placeholder="/Users/..." required style={inputStyle} />
              </div>
            )}
            
            <button type="submit" style={{ padding: '12px 24px', background: '#2D2D35', color: '#ffffff', border: 'none', borderRadius: '10px', fontSize: '0.92rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', marginTop: '8px', transition: 'background 0.2s' }}>
              Activate Plugin
            </button>
            {statusMsg && <div style={{ fontSize: '0.88rem', color: '#d97706', fontWeight: 600, marginTop: '4px' }}>{statusMsg}</div>}
          </form>
        </section>

        {/* 2. Active Plugins 리스트 */}
        <section style={{ ...glassCardStyle, padding: '24px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '16px', color: '#2D2D35', marginTop: 0 }}>Active Plugins</h2>
          <div style={{ border: '1px solid rgba(0, 0, 0, 0.08)', borderRadius: '12px', overflowX: 'auto', backgroundColor: 'rgba(255, 255, 255, 0.5)' }}>
            {installedPlugins.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6E6E7A', fontSize: '0.9rem', fontWeight: 500 }}>장착된 플러그인이 없습니다.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', tableLayout: 'fixed' }}>
                <thead style={{ backgroundColor: 'rgba(0, 0, 0, 0.03)', borderBottom: '1px solid rgba(0, 0, 0, 0.08)', color: '#4E4E5A' }}>
                  <tr>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 700, width: '20%' }}>Name</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 700, width: '15%' }}>Type</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 700, width: '50%' }}>Info</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 700, width: '15%' }}>Action</th>
                  </tr>
                </thead>
                <tbody style={{ color: '#111111', fontWeight: 500 }}>
                  {installedPlugins.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.04)' }}>
                      <td style={{ padding: '14px 16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(0, 0, 0, 0.05)', border: '1px solid rgba(0, 0, 0, 0.05)', color: '#2D2D35', fontWeight: 700 }}>
                          {p.type.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#4E4E5A', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.type === 'local' ? p.workspaceDir : p.url}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <button onClick={() => handleRemovePlugin(p.id, p.name)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.88rem', cursor: 'pointer', fontWeight: 700 }}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}