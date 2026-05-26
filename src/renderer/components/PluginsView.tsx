// src/renderer/components/PluginsView.tsx
import React, { useState, useEffect } from 'react';

export default function PluginsView() {
  const [pluginType, setPluginType] = useState<'remote' | 'custom' | 'local'>('remote');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [installedPlugins, setInstalledPlugins] = useState<any[]>([]);
  const [downloadUrl, setDownloadUrl] = useState('');

  // 1. 실행할 로컬 JS 스크립트 파일의 절대 경로 State
  const [customScriptPath, setCustomScriptPath] = useState('');
  // 2. 다운로드(custom)와 로컬 파일(local)이 공용으로 사용할 작업 공간 폴더 경로 State
  const [pluginWorkspaceDir, setPluginWorkspaceDir] = useState('');
  
  // 💡 [신규 추가] 사용자가 직접 타이핑한 트리거 키워드 문자열 State (예: "파일,메모,로그")
  const [keywordsInput, setKeywordsInput] = useState('');

  // 디바이스에 등록된 전체 MCP 플러그인 리스트 갱신
  const refreshPluginsList = async () => {
    const list = await window.electronAPI.getMcpPluginsList();
    setInstalledPlugins(list || []);
  };

  useEffect(() => {
    refreshPluginsList();
  }, []);

  // Electron 네이티브 파일 선택 다이얼로그 호출
  const handleSelectFile = async () => {
    try {
      const result = await window.electronAPI.openFileDialog();
      if (result && !result.canceled && result.filePaths.length > 0) {
        setCustomScriptPath(result.filePaths[0]);
        setStatusMsg('스크립트 파일 경로가 성공적으로 매핑되었습니다.');
      }
    } catch (err: any) {
      setStatusMsg(`파일 선택 실패: ${err.message}`);
    }
  };

  // 플러그인 동적 등록 핸들러
  const handleAddPlugin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg('초기화 중...');

    // 💡 [공통 전처리] 입력받은 콤마 구분 키워드 문자열을 정제된 string[] 배열로 변환합니다.
    const parsedKeywords = keywordsInput
      ? keywordsInput.split(',').map(k => k.trim()).filter(Boolean)
      : [];

    // 분기 1. 외부 URL 원격 파일 다운로드 모드 (custom)
    if (pluginType === 'custom') {
      if (!downloadUrl || !name || !pluginWorkspaceDir) {
        setStatusMsg('오류: 별칭, 다운로드 주소, 작업 공간 폴더 경로는 모두 필수입니다.');
        return;
      }
      try {
        const res = await window.electronAPI.downloadPlugin({ 
          downloadUrl, 
          aliasName: name,
          workspaceDir: pluginWorkspaceDir,
          keywords: parsedKeywords // 💡 다운로드 플러그인용 동적 필터 키워드 주입
        } as any); 
        
        if (res.success) {
          setName(''); 
          setDownloadUrl('');
          setPluginWorkspaceDir('');
          setKeywordsInput(''); // 초기화
          setStatusMsg('외부 스크립트 다운로드 및 지정된 워킹 디렉토리 설정이 완료되었습니다!');
          refreshPluginsList();
        } else { 
          setStatusMsg(`오류: ${res.error}`); 
        }
      } catch (err: any) { 
        setStatusMsg(`시스템 오류: ${err.message}`); 
      }
      return;
    }

    // 분기 2. 로컬 자바스크립트 파일 연동 및 작업 폴더 지정 모드 (local)
    if (pluginType === 'local') {
      if (!customScriptPath || !name || !pluginWorkspaceDir) {
        setStatusMsg('오류: 별칭, 스크립트 파일 경로, 작업 공간 폴더 경로는 모두 필수입니다.');
        return;
      }
      
      const config = {
        id: `plugin-${Date.now()}`,
        type: 'custom' as any, 
        name,
        enabled: true,
        scriptPath: customScriptPath,     
        workspaceDir: pluginWorkspaceDir,
        keywords: parsedKeywords // 💡 로컬 경로 연결 플러그인용 동적 필터 키워드 주입
      };
      
      try {
        const res = await window.electronAPI.addMcpPlugin(config);
        if (res.success) {
          setName('');
          setCustomScriptPath('');
          setPluginWorkspaceDir('');
          setKeywordsInput(''); // 초기화
          setStatusMsg('로컬 스크립트 플러그인이 성공적으로 장착되었습니다.');
          refreshPluginsList();
        } else {
          setStatusMsg(`오류: ${res.error}`);
        }
      } catch (err: any) {
        setStatusMsg(`시스템 오류: ${err.message}`);
      }
      return;
    }

    // 분기 3. 원격 독립 엔드포인트 네트워크 연결 모드 (remote)
    const config = {
      id: `plugin-${Date.now()}`, 
      type: pluginType as any, 
      name, 
      enabled: true,
      url,
      apiKey,
      keywords: parsedKeywords // 💡 원격 서버 연동 플러그인용 동적 필터 키워드 주입
    };
    try {
      const res = await window.electronAPI.addMcpPlugin(config);
      if (res.success) {
        setName(''); setUrl(''); setApiKey('');
        setKeywordsInput(''); // 초기화
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
    boxSizing: 'border-box'
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
            {/* 기본 정보 설정 그리드 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <div style={labelStyle}>Plugin Type</div>
                <select value={pluginType} onChange={(e) => setPluginType(e.target.value as any)} style={inputStyle}>
                  <option value="remote" style={{ backgroundColor: '#F4F4F6', color: '#111' }}>Remote Endpoint (URL)</option>
                  <option value="custom" style={{ backgroundColor: '#F4F4F6', color: '#111' }}>Download Script (.js URL)</option>
                  <option value="local" style={{ backgroundColor: '#F4F4F6', color: '#111' }}>Local Script File (.js Local)</option>
                </select>
              </div>
              <div>
                <div style={labelStyle}>Plugin Alias</div>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="별칭 입력" required style={inputStyle} />
              </div>
            </div>

            {/* 💡 [UI 확장] 모든 플러그인이 가동 문맥을 판단할 트리거 키워드 입력 필드 전면 배치 */}
            <div>
              <div style={labelStyle}>Trigger Keywords (쉼표로 구분)</div>
              <input 
                type="text" 
                value={keywordsInput} 
                onChange={e => setKeywordsInput(e.target.value)} 
                placeholder="AI 대화 내용 중 매칭할 트리거 단어를 적어주세요 (예: 파일,메모,로그,텍스트)" 
                style={inputStyle} 
              />
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
            ) : pluginType === 'custom' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <div style={labelStyle}>Plugin Download URL</div>
                  <input type="url" value={downloadUrl} onChange={e => setDownloadUrl(e.target.value)} placeholder="https://raw.githubusercontent.com/.../plugin.js" required style={inputStyle} />
                </div>
                <div>
                  <div style={labelStyle}>Plugin Working Directory (Target Workspace)</div>
                  <input 
                    type="text" 
                    value={pluginWorkspaceDir} 
                    onChange={e => setPluginWorkspaceDir(e.target.value)} 
                    placeholder="다운로드된 플러그인이 파일 작업을 수행할 폴더 경로 (예: /Users/oxxultus/mcp-download-space)" 
                    required 
                    style={inputStyle} 
                  />
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <div style={labelStyle}>Absolute JavaScript File Path</div>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                    <input 
                      type="text" 
                      value={customScriptPath} 
                      onChange={e => setCustomScriptPath(e.target.value)} 
                      placeholder="예시: /Users/oxxultus/dev/my-mcp-tool.js" 
                      required 
                      style={{ ...inputStyle, flexGrow: 1 }} 
                    />
                    <button type="button" onClick={handleSelectFile} style={{ padding: '12px 20px', background: '#E3E1D9', border: '1px solid rgba(0,0,0,0.15)', color: '#2D2D35', borderRadius: '10px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      파일 선택
                    </button>
                  </div>
                </div>

                <div>
                  <div style={labelStyle}>Plugin Working Directory (Target Workspace)</div>
                  <input 
                    type="text" 
                    value={pluginWorkspaceDir} 
                    onChange={e => setPluginWorkspaceDir(e.target.value)} 
                    placeholder="플러그인이 실제로 파일 작업을 수행할 폴더 경로를 입력하세요. (예: /Users/oxxultus/mcp-workspace)" 
                    required 
                    style={inputStyle} 
                  />
                </div>
              </div>
            )}
            
            <button type="submit" style={{ padding: '12px 24px', background: '#2D2D35', color: '#ffffff', border: 'none', borderRadius: '10px', fontSize: '0.92rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', marginTop: '8px' }}>
              {pluginType === 'local' ? 'Link & Activate Plugin' : 'Activate Plugin'}
            </button>
            {statusMsg && <div style={{ fontSize: '#0.88rem', color: '#d97706', fontWeight: 600, marginTop: '4px' }}>{statusMsg}</div>}
          </form>
        </section>

        {/* 2. Active Plugins 리스트 세션 */}
        <section style={{ ...glassCardStyle, padding: '24px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: '16px', color: '#2D2D35', marginTop: 0 }}>Active Plugins</h2>
          <div style={{ border: '1px solid rgba(0, 0, 0, 0.08)', borderRadius: '12px', overflowX: 'auto', backgroundColor: 'rgba(255, 255, 255, 0.5)' }}>
            {installedPlugins.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#6E6E7A', fontSize: '0.9rem', fontWeight: 500 }}>장착된 플러그인이 없습니다.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', tableLayout: 'fixed' }}>
                <thead style={{ backgroundColor: 'rgba(0, 0, 0, 0.03)', borderBottom: '1px solid rgba(0, 0, 0, 0.08)', color: '#4E4E5A' }}>
                  <tr>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 700, width: '20%' }}>Name</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 700, width: '15%' }}>Type</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: 700, width: '50%' }}>Script File Path / Info</th>
                    <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: 700, width: '15%' }}>Action</th>
                  </tr>
                </thead>
                <tbody style={{ color: '#111111', fontWeight: 500 }}>
                  {installedPlugins.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(0, 0, 0, 0.04)' }}>
                      <td style={{ padding: '14px 16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ 
                          fontSize: '0.72rem', padding: '3px 8px', borderRadius: '6px', 
                          backgroundColor: p.type === 'custom' ? 'rgba(217, 119, 6, 0.1)' : 'rgba(0, 0, 0, 0.05)', 
                          border: p.type === 'custom' ? '1px solid rgba(217, 119, 6, 0.2)' : '1px solid rgba(0, 0, 0, 0.05)', 
                          color: p.type === 'custom' ? '#d97706' : '#2D2D35', fontWeight: 700 
                        }}>
                          {p.type.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', color: '#4E4E5A', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                        {p.type === 'remote' ? p.url : p.workspaceDir}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <button onClick={() => handleRemovePlugin(p.id, p.name)} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '0.88rem', cursor: 'pointer', fontWeight: 700 }}>Delete</button>
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