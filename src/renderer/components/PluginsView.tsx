// src/renderer/components/PluginsView.tsx
import React, { useState, useEffect, useRef } from 'react';

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
  Globe: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  Terminal: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
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
  )
};

export default function PluginsView() {
  const [installedPlugins, setInstalledPlugins] = useState<any[]>([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [hoveredPluginId, setHoveredPluginId] = useState<string | null>(null);

  // 모달 제어 상태 스위치
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); 

  // 더보기 컨텍스트 메뉴용 제어 상태
  const [menuOpenPluginId, setMenuOpenPluginId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 폼 입력 관리 유닛 상태 (UI 바인딩용 스위치는 'local' 유지, 백엔드에는 'custom'으로 정제 전송)
  const [pluginType, setPluginType] = useState<'remote' | 'custom' | 'local'>('remote');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [customScriptPath, setCustomScriptPath] = useState('');
  
  // 작업 경로 선택 지정 스위치 및 경로 명세 상태
  const [useWorkspace, setUseWorkspace] = useState(true);
  const [pluginWorkspaceDir, setPluginWorkspaceDir] = useState('');
  const [keywordsInput, setKeywordsInput] = useState('');
  
  // 수정 타겟팅 포인터
  const [targetPluginId, setTargetPluginId] = useState<string | null>(null);

  const refreshPluginsList = async () => {
    const list = await window.electronAPI.getMcpPluginsList();
    setInstalledPlugins(list || []);
  };

  useEffect(() => { refreshPluginsList(); }, []);

  // 외부 클릭 감지 리스너
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenPluginId(null);
      }
    };
    if (menuOpenPluginId) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [menuOpenPluginId]);

  const handleSelectFile = async () => {
    try {
      const result = await window.electronAPI.openFileDialog();
      if (result && !result.canceled && result.filePaths.length > 0) {
        setCustomScriptPath(result.filePaths[0]);
      }
    } catch (err: any) { alert(`파일 선택 실패: ${err.message}`); }
  };

  const handleOpenMenu = (e: React.MouseEvent, pluginId: string) => {
    e.stopPropagation();
    if (menuOpenPluginId === pluginId) {
      setMenuOpenPluginId(null);
    } else {
      setMenuOpenPluginId(pluginId);
    }
  };

  const handleStartEditModal = (id: string, currentName: string, currentKeywords: any) => {
    setTargetPluginId(id);
    setName(currentName);
    const keywordsStr = Array.isArray(currentKeywords) ? currentKeywords.join(',') : String(currentKeywords || '');
    setKeywordsInput(keywordsStr);
    
    setIsEditModalOpen(true);
    setMenuOpenPluginId(null);
  };

  const handleSaveEditPopup = async () => {
    if (!targetPluginId || !name.trim()) return;

    const parsedKeywords = keywordsInput
      ? keywordsInput.split(',').map(k => k.trim()).filter(Boolean)
      : [];

    const targetPlugin = installedPlugins.find(p => p.id === targetPluginId);
    if (!targetPlugin) return;

    const updateConfig = {
      id: targetPlugin.id,
      type: targetPlugin.type,
      name: name.trim(),
      url: targetPlugin.url || targetPlugin.scriptPath,
      apiKey: targetPlugin.apiKey,
      workspaceDir: targetPlugin.workspaceDir,
      keywords: parsedKeywords,
      enabled: true
    };

    const res = await window.electronAPI.addMcpPlugin(updateConfig as any);
    if (res.success) {
      setIsEditModalOpen(false);
      setTargetPluginId(null);
      setName('');
      setKeywordsInput('');
      refreshPluginsList();
    } else {
      alert(`정보 수정 실패: ${res.error}`);
    }
  };

  const handleAddPlugin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg('초기화 중...');

    const parsedKeywords = keywordsInput
      ? keywordsInput.split(',').map(k => k.trim()).filter(Boolean)
      : [];

    const finalWorkspaceDir = useWorkspace ? pluginWorkspaceDir.trim() : '';
    const generatedId = `custom-${Date.now()}`;

    const config: any = {
      id: generatedId,
      name: name.trim(),
      keywords: parsedKeywords,
      enabled: true
    };

    if (pluginType === 'remote') {
      config.type = 'remote';
      config.url = url.trim();
      config.apiKey = apiKey.trim();
    } else {
      config.type = 'custom';
      config.workspaceDir = useWorkspace ? finalWorkspaceDir : undefined;
      
      if (pluginType === 'custom') {
        if (!downloadUrl || !name || (useWorkspace && !finalWorkspaceDir)) {
          setStatusMsg('오류: 모든 필수 값을 기입해 주세요.');
          return;
        }
        config.url = downloadUrl.trim();
      } else {
        if (!customScriptPath || !name || (useWorkspace && !finalWorkspaceDir)) {
          setStatusMsg('오류: 모든 필수 값을 기입해 주세요.');
          return;
        }
        config.url = customScriptPath.trim();
      }
    }

    try {
      const res = await window.electronAPI.addMcpPlugin(config);
      if (res.success) {
        resetForm();
        refreshPluginsList();
      } else {
        setStatusMsg(`오류: ${res.error}`);
      }
    } catch (err: any) {
      setStatusMsg(`시스템 오류: ${err.message}`);
    }
  };

  const resetForm = () => {
    setName(''); setUrl(''); setApiKey(''); setDownloadUrl('');
    setCustomScriptPath(''); setPluginWorkspaceDir(''); setKeywordsInput('');
    setPluginType('remote');
    setUseWorkspace(true);
    setStatusMsg(''); setIsAddModalOpen(false);
  };

  const handleRemovePlugin = async (id: string, pluginName: string) => {
    setMenuOpenPluginId(null);
    if (!confirm(`[${pluginName}] 플러그인을 제거하시겠습니까?`)) return;
    const res = await window.electronAPI.removeMcpPlugin(id);
    if (res.success) refreshPluginsList();
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '8px',
    border: '1px solid var(--border-glass-input)',
    color: 'var(--color-text-main)', fontWeight: 500, fontSize: '0.9rem', outline: 'none',
    marginTop: '6px', boxSizing: 'border-box'
  };

  const labelStyle: React.CSSProperties = { fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-muted)' };

  const getBadgeTypeStyle = (type: string) => {
    const isCustom = type === 'custom';
    return {
      fontSize: '0.68rem', padding: '3px 8px', borderRadius: '6px', fontWeight: 800, textTransform: 'uppercase' as const,
      backgroundColor: isCustom ? 'rgba(217, 119, 6, 0.12)' : 'rgba(128, 128, 128, 0.12)',
      border: isCustom ? '1px solid rgba(217, 119, 6, 0.25)' : '1px solid rgba(128, 128, 128, 0.2)',
      color: isCustom ? '#f59e0b' : 'var(--color-text-main)'
    };
  };

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', backgroundColor: 'transparent', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: '840px', margin: '0 auto', padding: '40px 24px', display: 'flex', flexDirection: 'column', gap: '24px', boxSizing: 'border-box' }}>
        
        {/* 대시보드 상단 바 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid rgba(128,128,128,0.15)', paddingBottom: '16px' }}>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--color-text-main)', margin: 0, letterSpacing: '-0.02em' }}>MCP Ecosystem</h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>컨텍스트 기반으로 자동 연동되는 외부 도구 플러그인 레지스트리</p>
          </div>
          
          <button
            onClick={() => setIsAddModalOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px',
              background: 'var(--color-text-main)', color: 'var(--color-btn-text)', border: 'none', borderRadius: '10px',
              fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', transition: 'background-color 0.15s',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
            }}
          >
            <Icon.Plus /> Add Plugin
          </button>
        </div>

        {/* 그리드 카드 목록 영역 */}
        <section style={{ marginTop: '8px' }}>
          {installedPlugins.length === 0 ? (
            <div style={{ 
              padding: '60px 20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem', fontWeight: 500,
              background: 'var(--bg-glass-card)', borderRadius: '16px', border: 'var(--border-glass)'
            }}>
              🔌 장착된 MCP 플러그인이 없습니다. 상단의 Add Plugin 버튼을 눌러 추가하세요.
            </div>
          ) : (
            // 💡 [수정] Grid Item들이 자식의 고유 너비 때문에 늘어나는 것을 제어하기 위해 grid-template-columns에 minmax(0, 1fr) 규격 부여
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px' }}>
              {installedPlugins.map((p) => {
                const isRemote = p.type === 'remote';
                const hasKeywords = p.keywords && (Array.isArray(p.keywords) ? p.keywords.length > 0 : String(p.keywords).trim().length > 0);
                const hasWorkspace = p.workspaceDir && p.workspaceDir.trim().length > 0;
                
                return (
                  <div 
                    key={p.id}
                    onMouseEnter={() => setHoveredPluginId(p.id)}
                    onMouseLeave={() => setHoveredPluginId(null)}
                    style={{
                      background: 'var(--bg-glass-card)', border: 'var(--border-glass)',
                      borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column',
                      gap: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.02)', position: 'relative',
                      height: '135px', boxSizing: 'border-box',
                      minWidth: 0 // 💡 [수정] 부모 flex 컨테이너가 축소 가능하도록 minWidth 해제
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '70%' }}>
                        <span style={{ color: 'var(--color-text-muted)', opacity: 0.8, display: 'flex', alignItems: 'center' }}>
                          {isRemote ? <Icon.Globe /> : <Icon.Terminal />}
                        </span>
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text-main)' }}>{p.name}</span>
                      </div>
                      <span style={getBadgeTypeStyle(p.type)}>
                        {p.type}
                      </span>
                    </div>

                    {/* 중간 내용 영역 명확히 미니멈 영역 확보 */}
                    <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {isRemote ? 'Endpoint Connection' : 'Local Workspace'}
                      </div>
                      
                      {/* 가로 스크롤바가 숨겨진 채 정상 작동하도록 최적화 처리 */}
                      <div style={{ width: '100%', overflow: 'hidden', minWidth: 0 }}>
                        <div 
                          style={{ 
                            fontSize: '0.82rem', 
                            color: 'var(--color-text-main)', 
                            fontFamily: 'monospace', 
                            marginTop: '2px', 
                            wordBreak: 'keep-all', 
                            whiteSpace: 'nowrap', 
                            overflowX: 'auto', 
                            maxWidth: '100%',
                            paddingBottom: '4px'
                          }} 
                          title={isRemote ? p.url : (hasWorkspace ? p.workspaceDir : '지정되지 않음 (제한 없음)')}
                        >
                          {isRemote ? p.url : (hasWorkspace ? p.workspaceDir : '🔓 지정되지 않음 (제한 없음)')}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(128,128,128,0.1)', paddingTop: '8px' }}>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                        {hasKeywords ? `🎯 키워드: ${p.keywords}` : '🔓 상시 대기조'}
                      </div>
                    </div>

                    {/* 더보기 버튼 */}
                    {(hoveredPluginId === p.id || menuOpenPluginId === p.id) && (
                      <button
                        onClick={(e) => handleOpenMenu(e, p.id)}
                        style={{
                          position: 'absolute', bottom: '12px', right: '14px',
                          background: 'transparent', border: 'none',
                          color: menuOpenPluginId === p.id ? 'var(--color-text-main)' : 'var(--color-text-muted)', 
                          cursor: 'pointer', padding: '4px', borderRadius: '4px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          zIndex: 10
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(128,128,128,0.08)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <Icon.More />
                      </button>
                    )}

                    {/* 카드 내부 메뉴 드롭다운 */}
                    {menuOpenPluginId === p.id && (
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
                          onClick={() => handleStartEditModal(p.id, p.name, p.keywords)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px',
                            border: 'none', background: 'transparent', borderRadius: '6px',
                            fontSize: '0.78rem', fontWeight: 500, color: 'var(--color-text-main)', cursor: 'pointer',
                            textAlign: 'left', width: '100%'
                          }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(128,128,128,0.08)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <Icon.Edit /> 플러그인 수정
                        </button>
                        <button
                          onClick={() => handleRemovePlugin(p.id, p.name)}
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
                );
              })}
            </div>
          )}
        </section>

        {/* 플러그인 신규 생성 등록 모달 팝업 */}
        {isAddModalOpen && (
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.3)', backdropFilter: 'blur(15px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000
          }} onClick={resetForm}>
            <div style={{
              width: '460px', padding: '24px', borderRadius: '18px',
              background: 'var(--bg-modal)',
              border: 'var(--border-glass)', boxShadow: '0 25px 60px rgba(0, 0, 0, 0.2)',
              display: 'flex', flexDirection: 'column', gap: '16px'
            }} onClick={e => e.stopPropagation()}>
              
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text-main)' }}>플러그인 추가 등록</div>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>유형을 선택하고 필요한 리소스를 주입하세요.</p>
              </div>

              <form onSubmit={handleAddPlugin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <div style={labelStyle}>Plugin Type</div>
                    <select value={pluginType} onChange={(e) => setPluginType(e.target.value as any)} style={inputStyle}>
                      <option value="remote" style={{ background: 'var(--bg-input)' }}>Remote Endpoint</option>
                      <option value="custom" style={{ background: 'var(--bg-input)' }}>Download Script</option>
                      <option value="local" style={{ background: 'var(--bg-input)' }}>Local Script File</option>
                    </select>
                  </div>
                  <div>
                    <div style={labelStyle}>Plugin Alias</div>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="예: 파일매니저" required style={inputStyle} />
                  </div>
                </div>

                <div>
                  <div style={labelStyle}>Trigger Keywords (쉼표 구분)</div>
                  <input type="text" value={keywordsInput} onChange={e => setKeywordsInput(e.target.value)} placeholder="예: 파일,메모,로그 (미입력 시 상시 대기)" style={inputStyle} />
                </div>

                {pluginType === 'remote' ? (
                  <>
                    <div>
                      <div style={labelStyle}>Endpoint URL</div>
                      <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="http://localhost:8080/mcp" required style={inputStyle} />
                    </div>
                    <div>
                      <div style={labelStyle}>Security Token</div>
                      <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="API 키 보안 토큰" required style={inputStyle} />
                    </div>
                  </>
                ) : (
                  <>
                    {pluginType === 'custom' ? (
                      <div>
                        <div style={labelStyle}>Plugin Download URL</div>
                        <input type="url" value={downloadUrl} onChange={e => setDownloadUrl(e.target.value)} placeholder="https://raw.githubusercontent.com/.../tool.js" required style={inputStyle} />
                      </div>
                    ) : (
                      <div>
                        <div style={labelStyle}>JavaScript File Path</div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                          <input type="text" value={customScriptPath} onChange={e => setCustomScriptPath(e.target.value)} placeholder="/Users/.../tool.js" required style={{ ...inputStyle, flexGrow: 1 }} />
                          <button type="button" onClick={handleSelectFile} style={{ padding: '10px 14px', background: 'rgba(128,128,128,0.1)', border: '1px solid rgba(128,128,128,0.15)', color: 'var(--color-text-main)', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                            파일 탐색
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 체크박스를 토글하여 작업 공간 주입을 선택적으로 제어하는 유닛 블록 */}
                    <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                        <input 
                          type="checkbox" 
                          checked={useWorkspace} 
                          onChange={(e) => {
                            setUseWorkspace(e.target.checked);
                            if(!e.target.checked) setPluginWorkspaceDir('');
                          }}
                          style={{ cursor: 'pointer', width: '15px', height: '15px' }}
                        />
                        파일 작업 디렉토리(Workspace) 연동하기
                      </label>

                      {/* 체크가 true 일 때만 필드 렌더링 활성화 */}
                      {useWorkspace && (
                        <div style={{ animation: 'fadeIn 0.2s ease-in-out' }}>
                          <input 
                            type="text" 
                            value={pluginWorkspaceDir} 
                            onChange={e => setPluginWorkspaceDir(e.target.value)} 
                            placeholder={pluginType === 'custom' ? "파일 작업 전용 디렉토리 절대경로" : "실제 파일 연동이 일어날 빈 작업 폴더 경로"} 
                            required={useWorkspace} 
                            style={inputStyle} 
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}

                {statusMsg && <div style={{ fontSize: '0.82rem', color: '#dc2626', fontWeight: 600 }}>{statusMsg}</div>}

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
                  <button type="button" onClick={resetForm} style={{ padding: '9px 16px', border: 'none', background: 'rgba(128,128,128,0.1)', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                    취소
                  </button>
                  <button type="submit" style={{ padding: '9px 16px', border: 'none', background: 'var(--color-text-main)', color: 'var(--color-btn-text)', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                    Activate
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 플러그인 별칭 및 키워드 동시 수정 모달 팝업 레이어 */}
        {isEditModalOpen && (
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.3)', backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000
          }} onClick={() => { setIsEditModalOpen(false); setTargetPluginId(null); }}>
            <div style={{
              width: '360px', padding: '24px', borderRadius: '16px',
              background: 'var(--bg-modal)',
              border: 'var(--border-glass)', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
              display: 'flex', flexDirection: 'column', gap: '16px'
            }} onClick={e => e.stopPropagation()}>
              
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text-main)' }}>플러그인 정보 수정</div>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>별칭 이름과 트리거 컨텍스트 필터를 수정합니다.</p>
              </div>

              <div>
                <div style={labelStyle}>Plugin Alias</div>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="새로운 플러그인 별칭 이름"
                  autoFocus
                  style={inputStyle}
                />
              </div>

              <div>
                <div style={labelStyle}>Trigger Keywords (쉼표 구분)</div>
                <input
                  type="text"
                  value={keywordsInput}
                  onChange={e => setKeywordsInput(e.target.value)}
                  placeholder="예: 파일,메모,백업 (비워두면 상시 가동)"
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveEditPopup();
                    if (e.key === 'Escape') { setIsEditModalOpen(false); setTargetPluginId(null); }
                  }}
                  style={inputStyle}
                />
              </div>
              
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => { setIsEditModalOpen(false); setTargetPluginId(null); }}
                  style={{ padding: '8px 14px', border: 'none', background: 'rgba(128,128,128,0.1)', borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-muted)', cursor: 'pointer' }}
                >취소</button>
                <button
                  type="button"
                  onClick={handleSaveEditPopup}
                  disabled={!name.trim()}
                  style={{ 
                    padding: '8px 14px', border: 'none', background: 'var(--color-text-main)', color: 'var(--color-btn-text)', borderRadius: '6px', 
                    fontSize: '0.82rem', fontWeight: 600, 
                    cursor: name.trim() ? 'pointer' : 'not-allowed', opacity: name.trim() ? 1 : 0.5 
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