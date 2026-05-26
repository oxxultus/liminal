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

  const refreshPluginsList = async () => {
    const list = await window.electronAPI.getMcpPluginsList();
    setInstalledPlugins(list || []);
  };

  useEffect(() => {
    refreshPluginsList();
  }, []);

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
    
    const res = await window.electronAPI.addMcpPlugin(config);
    if (res.success) {
      setName(''); setUrl(''); setApiKey(''); setWorkspaceDir('');
      setStatusMsg('성공적으로 추가되었습니다.');
      refreshPluginsList();
    } else {
      setStatusMsg(`오류: ${res.error}`);
    }
  };

  const handleRemovePlugin = async (id: string, pluginName: string) => {
    if (!confirm(`[${pluginName}] 플러그인을 삭제하시겠습니까?`)) return;
    const res = await window.electronAPI.removeMcpPlugin(id);
    if (res.success) refreshPluginsList();
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid rgba(207, 250, 254, 0.12)',
    backgroundColor: 'rgba(0, 0, 0, 0.25)', color: '#ffffff', fontSize: '0.9rem', outline: 'none', marginTop: '8px', boxSizing: 'border-box'
  };

  const labelStyle: React.CSSProperties = { fontSize: '0.85rem', fontWeight: 600, color: 'rgba(207, 250, 254, 0.7)' };

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', overflowX: 'hidden', backgroundColor: 'transparent', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: '48px', boxSizing: 'border-box' }}>
        
        {/* 1. MCP 플러그인 추가 섹션 */}
        <section style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '28px', borderRadius: '16px', border: '1px solid rgba(207, 250, 254, 0.08)', boxSizing: 'border-box' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '4px', color: '#fff' }}>Add MCP Plugin</h2>
          <p style={{ fontSize: '0.85rem', color: 'rgba(207, 250, 254, 0.4)', marginBottom: '24px' }}>새로운 자원 조작 플러그인을 에코시스템에 마운트합니다.</p>
          
          <form onSubmit={handleAddPlugin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <div style={labelStyle}>Plugin Type</div>
                <select value={pluginType} onChange={(e) => setPluginType(e.target.value as 'remote' | 'local')} style={inputStyle}>
                  <option value="remote" style={{ backgroundColor: '#221133' }}>Remote (FastAPI)</option>
                  <option value="local" style={{ backgroundColor: '#221133' }}>Local Workspace</option>
                </select>
              </div>
              <div>
                <div style={labelStyle}>Plugin Alias</div>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="별칭 입력" required style={inputStyle} />
              </div>
            </div>

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
            
            <button type="submit" style={{ padding: '12px 24px', background: 'linear-gradient(135deg, #1e3a8a 0%, #06b6d4 100%)', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(6,182,212,0.2)' }}>
              Activate Plugin
            </button>
            {statusMsg && <div style={{ fontSize: '0.85rem', color: '#fdcb6e', fontWeight: 500, marginTop: '10px' }}>{statusMsg}</div>}
          </form>
        </section>

        {/* 2. Active Plugins 리스트 */}
        <section style={{ marginBottom: '60px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '4px', color: '#fff' }}>Active Plugins</h2>
          <div style={{ border: '1px solid rgba(207, 250, 254, 0.08)', borderRadius: '12px', overflowX: 'auto', backgroundColor: 'rgba(0,0,0,0.15)' }}>
            {installedPlugins.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(207, 250, 254, 0.3)', fontSize: '0.9rem' }}>장착된 플러그인이 없습니다.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', tableLayout: 'fixed' }}>
                <thead style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(207, 250, 254, 0.08)', color: 'rgba(207, 250, 254, 0.6)' }}>
                  <tr>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 600, width: '20%' }}>Name</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 600, width: '15%' }}>Type</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 600, width: '50%' }}>Info</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 600, width: '15%' }}>Action</th>
                  </tr>
                </thead>
                <tbody style={{ color: 'rgba(207, 250, 254, 0.85)' }}>
                  {installedPlugins.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(207, 250, 254, 0.04)' }}>
                      <td style={{ padding: '14px 16px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</td>
                      <td style={{ padding: '14px 16px' }}><span style={{ fontSize: '0.75rem', padding: '3px 8px', borderRadius: '6px', backgroundColor: 'rgba(207, 250, 254, 0.1)', color: '#ffffff' }}>{p.type.toUpperCase()}</span></td>
                      <td style={{ padding: '14px 16px', color: 'rgba(207, 250, 254, 0.5)', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.type === 'local' ? p.workspaceDir : p.url}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <button onClick={() => handleRemovePlugin(p.id, p.name)} style={{ background: 'none', border: 'none', color: '#ff7675', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 }}>Delete</button>
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