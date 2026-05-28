// src/renderer/components/PluginsView.tsx
import React, { useState, useEffect, useRef } from 'react';
// 자연스러운 레이아웃 전환 애니메이션을 위한 framer-motion 임포트
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
  ),
  EmptyState: () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-muted)', opacity: 0.6, marginBottom: '12px' }}>
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10"/>
    </svg>
  ),
  Unlock: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', marginRight: '5px', verticalAlign: 'middle' }}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
    </svg>
  ),
  Activity: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', marginRight: '5px', verticalAlign: 'middle' }}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  Tag: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', marginRight: '5px', verticalAlign: 'middle' }}>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  )
};

export default function PluginsView() {
  const [installedPlugins, setInstalledPlugins] = useState<any[]>([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [hoveredPluginId, setHoveredPluginId] = useState<string | null>(null);
  const [onlineStates, setOnlineStates] = useState<Record<string, boolean>>({});

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); 

  const [menuOpenPluginId, setMenuOpenPluginId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [pluginType, setPluginType] = useState<'remote' | 'custom' | 'local'>('remote');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [customScriptPath, setCustomScriptPath] = useState('');
  
  const [useWorkspace, setUseWorkspace] = useState(true);
  const [pluginWorkspaceDir, setPluginWorkspaceDir] = useState('');
  const [keywordsInput, setKeywordsInput] = useState('');
  
  const [targetPluginId, setTargetPluginId] = useState<string | null>(null);

  const pluginsRef = useRef<any[]>([]);
  useEffect(() => {
    pluginsRef.current = installedPlugins;
  }, [installedPlugins]);

  const checkRemotePluginsHealth = async (plugins: any[]) => {
    const remotePlugins = plugins.filter(p => p.type === 'remote' && p.enabled);
    if (remotePlugins.length === 0) return;
    
    const results: Record<string, boolean> = {};
    await Promise.all(
      remotePlugins.map(async (p) => {
        if (p.url && window.electronAPI.checkRemoteStatus) {
          const isOnline = await window.electronAPI.checkRemoteStatus({ 
            url: p.url, 
            apiKey: p.apiKey || '' 
          });
          results[p.id] = isOnline;
        }
      })
    );
    setOnlineStates(prev => ({ ...prev, ...results }));
  };

  const refreshPluginsList = async () => {
    const list = await window.electronAPI.getMcpPluginsList();
    const cleanList = list || [];
    
    const sortedList = [...cleanList].sort((a, b) => {
      const aEnabled = a.enabled !== false ? 1 : 0;
      const bEnabled = b.enabled !== false ? 1 : 0;
      return bEnabled - aEnabled;
    });

    setInstalledPlugins(sortedList);
    checkRemotePluginsHealth(sortedList); 
  };

  useEffect(() => {
    refreshPluginsList();
    const liveTracker = setInterval(() => {
      const currentPlugins = pluginsRef.current;
      if (currentPlugins && currentPlugins.length > 0) {
        checkRemotePluginsHealth(currentPlugins);
      }
    }, 15000);
    return () => clearInterval(liveTracker);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenPluginId(null);
      }
    };
    if (menuOpenPluginId) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [menuOpenPluginId]);

  const handleToggleEnable = async (pluginId: string, currentStatus: boolean) => {
    if (!window.electronAPI.toggleMcpPlugin) return;
    
    const nextStatus = !currentStatus;
    const res = await window.electronAPI.toggleMcpPlugin({ pluginId, enabled: nextStatus });
    
    if (res.success) {
      const updatedList = installedPlugins.map(p => 
        p.id === pluginId ? { ...p, enabled: nextStatus } : p
      );
      
      const sortedList = [...updatedList].sort((a, b) => {
        const aEnabled = a.enabled !== false ? 1 : 0;
        const bEnabled = b.enabled !== false ? 1 : 0;
        return bEnabled - aEnabled;
      });

      setInstalledPlugins(sortedList);

      if (!nextStatus) {
        setOnlineStates(prev => {
          const updated = { ...prev };
          delete updated[pluginId];
          return updated;
        });
      } else {
        checkRemotePluginsHealth(sortedList);
      }
    } else {
      alert(`상태 전환 실패: ${res.error}`);
    }
  };

  const handleSelectFile = async () => {
    try {
      const result = await window.electronAPI.openFileDialog();
      if (result && !result.canceled && result.filePaths.length > 0) {
        setCustomScriptPath(result.filePaths[0]);
      }
    } catch (err: any) { alert(`파일 선택 실패: ${err.message}`); }
  };

  const handleOpenMenu = (e: React.MouseEvent<HTMLButtonElement>, pluginId: string) => {
    e.stopPropagation();
    if (menuOpenPluginId === pluginId) {
      setMenuOpenPluginId(null);
    } else {
      setMenuOpenPluginId(pluginId);
    }
  };

  const handleStartEditModal = (plugin: any) => {
    setTargetPluginId(plugin.id);
    setName(plugin.name);
    
    const keywordsStr = Array.isArray(plugin.keywords) 
      ? plugin.keywords.join(',') 
      : String(plugin.keywords || '');
    setKeywordsInput(keywordsStr);
    setPluginWorkspaceDir(plugin.workspaceDir || '');
    
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
      version: targetPlugin.version,
      workspaceDir: pluginWorkspaceDir.trim() || undefined,
      keywords: parsedKeywords,
      enabled: targetPlugin.enabled 
    };

    const res = await window.electronAPI.addMcpPlugin(updateConfig as any);
    if (res.success) {
      setIsEditModalOpen(false);
      setTargetPluginId(null);
      setName('');
      setKeywordsInput('');
      setPluginWorkspaceDir('');
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

  const baseBadgeStyle: React.CSSProperties = {
    fontSize: '0.65rem',
    padding: '2px 6px',
    borderRadius: '5px',
    fontWeight: 800,
    textTransform: 'uppercase' as const,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: '1',
    height: '18px',
    boxSizing: 'border-box',
    letterSpacing: '0.02em'
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '8px',
    border: '1px solid var(--border-glass-input)',
    color: 'var(--color-text-main)', fontWeight: 500, fontSize: '0.9rem', outline: 'none',
    marginTop: '6px', boxSizing: 'border-box'
  };

  const getBorderColor = (p: any, isEnabled: boolean, isServerOnline: boolean) => {
    if (!isEnabled) return 'var(--border-glass)'; // 비활성화는 기본 테두리
    if (p.type === 'remote') {
      return isServerOnline ? '#3b82f6' : '#ef4444'; // 연결 성공(Blue) / 유실(Red)
    }
    return '#f59e0b'; // Custom은 항상 오렌지색 테두리
  };

  const labelStyle: React.CSSProperties = { fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-muted)' };

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', backgroundColor: 'transparent', boxSizing: 'border-box' }}>
      {/* 💡 [네트워크 펄스 전용] 파란색 연결 인디케이터용 키프레임 정의 */}
      <style>{`
        @keyframes mcp-network-pulse {
          0% { transform: scale(0.95); opacity: 0.5; box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.6); }
          50% { transform: scale(1.05); opacity: 1; box-shadow: 0 0 8px 2px rgba(59, 130, 246, 0.4); }
          100% { transform: scale(0.95); opacity: 0.5; box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        }
      `}</style>

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
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '60px 20px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.9rem', fontWeight: 500,
              background: 'var(--bg-glass-card)', borderRadius: '16px', border: 'var(--border-glass)'
            }}>
              <Icon.EmptyState />
              장착된 MCP 플러그인이 없습니다. 상단의 Add Plugin 버튼을 눌러 추가하세요.
            </div>
          ) : (
            <motion.div 
              layout 
              style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px', width: '100%' }}
            >
              <AnimatePresence mode="popLayout">
                {installedPlugins.map((p) => {
                  const isRemote = p.type === 'remote';
                  const hasKeywords = p.keywords && (Array.isArray(p.keywords) ? p.keywords.length > 0 : String(p.keywords).trim().length > 0);
                  const hasWorkspace = p.workspaceDir && p.workspaceDir.trim().length > 0;
                  
                  const isEnabled = p.enabled !== false;
                  const isServerOnline = onlineStates[p.id] ?? false;

                  return (
                    <motion.div 
                      key={p.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ 
                        type: 'spring', 
                        stiffness: 400, 
                        damping: 38,
                        opacity: { duration: 0.25 }
                      }}
                      onMouseEnter={() => setHoveredPluginId(p.id)}
                      onMouseLeave={() => setHoveredPluginId(null)}
                      onClick={() => handleToggleEnable(p.id, isEnabled)}
                      style={{
                        background: isEnabled ? (p.type === 'remote' ? (isServerOnline ? 'rgba(59, 130, 246, 0.04)' : 'rgba(239, 68, 68, 0.04)') : 'rgba(245, 158, 11, 0.04)') : 'var(--bg-glass-card)', 
                        border: `1px solid ${getBorderColor(p, isEnabled, isServerOnline)}`,
                        borderRadius: '14px', padding: '18px', display: 'flex', flexDirection: 'column',
                        gap: '12px', 
                        boxShadow: isEnabled ? '0 6px 20px rgba(16, 185, 129, 0.08)' : '0 4px 16px rgba(0,0,0,0.01)',
                        position: 'relative',
                        height: '135px', boxSizing: 'border-box',
                        width: '100%', minWidth: 0,
                        cursor: 'pointer',
                        opacity: isEnabled ? 1 : 0.52,
                        transition: 'border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s ease, opacity 0.2s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {/* 왼쪽 명세 정보 레이아웃 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', maxWidth: '60%', flexWrap: 'nowrap' }}>
                          
                          <span style={{ 
                            color: isRemote 
                              ? (isServerOnline && isEnabled ? '#10b981' : 'var(--color-text-muted)') 
                              : (isEnabled ? 'var(--color-text-main)' : 'var(--color-text-muted)'), 
                            opacity: isEnabled ? 1 : 0.4, 
                            display: 'flex', 
                            alignItems: 'center', 
                            flexShrink: 0 
                          }}>
                            {isRemote ? <Icon.Globe /> : <Icon.Terminal />}
                          </span>

                          {/* 🟢 [활성화 고정 불빛] 플러그인이 켜지면 상시 대기중임을 알리는 심플 고정 그린 라이트 */}
                          {isEnabled && (
                            <span style={{
                              width: '6px', height: '6px', borderRadius: '50%',
                              backgroundColor: '#10b981', flexShrink: 0,
                              boxShadow: '0 0 5px #10b981'
                            }} />
                          )}

                          {/* 🔵🔴 [네트워크 연결 단독 지표] 원격 서버 타겟일 때만 가동되는 파란색/회색 듀얼 실시간 검증 라이트 */}
                          {isRemote && isEnabled && (
                            <span style={{
                              width: '6px', height: '6px', borderRadius: '50%',
                              backgroundColor: isServerOnline ? '#3b82f6' : '#ef4444',
                              flexShrink: 0,
                              // 연결 상태에 따라 애니메이션 클래스 제어
                              animation: isServerOnline ? 'mcp-network-pulse 1.5s infinite' : 'mcp-error-blink 1s infinite',
                              boxShadow: isServerOnline ? '0 0 5px #3b82f6' : '0 0 5px #ef4444'
                            }} />
                          )}

                          <span style={{ 
                            textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', 
                            fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text-main)',
                            opacity: isEnabled ? 1 : 0.6
                          }}>{p.name}</span>
                        </div>
                        
                        {/* 우측 상단 순수 명세 배지 집합소 */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                          {/* TYPE 배지 */}
                          <span style={{
                            ...baseBadgeStyle,
                            color: '#fff',
                            backgroundColor: p.type === 'custom' ? '#f59e0b' : (p.type === 'remote' ? '#3b82f6' : '#6b7280'),
                            boxShadow: isEnabled 
                              ? (p.type === 'custom' ? '0 2px 6px rgba(245,158,11,0.2)' : '0 2px 6px rgba(59,130,246,0.2)') 
                              : 'none',
                            opacity: isEnabled ? 1 : 0.5
                          }}>
                            {p.type}
                          </span>

                          {/* VERSION 배지 */}
                          <span style={{
                            ...baseBadgeStyle,
                            fontFamily: 'monospace',
                            color: 'var(--color-text-muted)',
                            backgroundColor: 'rgba(128, 128, 128, 0.06)',
                            border: '1px solid rgba(128, 128, 128, 0.15)',
                            opacity: isEnabled ? 1 : 0.4
                          }}>
                            v{p.version || '1.0.0'}
                          </span>
                        </div>
                      </div>

                      <div style={{ flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {isRemote ? 'Endpoint Connection' : 'Local Workspace'}
                        </div>
                        
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
                              paddingBottom: '4px',
                              opacity: isEnabled ? 1 : 0.5
                            }} 
                            title={isRemote ? p.url : (hasWorkspace ? p.workspaceDir : '지정되지 않음 (제한 없음)')}
                          >
                            {isRemote ? p.url : (hasWorkspace ? p.workspaceDir : <><Icon.Unlock />지정되지 않음 (제한 없음)</>)}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(128,128,128,0.1)', paddingTop: '8px' }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%', opacity: isEnabled ? 1 : 0.5 }}>
                          {hasKeywords ? <><Icon.Tag />키워드: {p.keywords}</> : <><Icon.Activity />상시 대기조</>}
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
                            onClick={() => handleStartEditModal(p)}
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

                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
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
                        <input type="url" value={downloadUrl} onChange={e => setUrl(e.target.value)} placeholder="https://raw.githubusercontent.com/.../tool.js" required style={inputStyle} />
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                          <input type="text" value={customScriptPath} onChange={e => setCustomScriptPath(e.target.value)} placeholder="/Users/.../tool.js" required style={{ ...inputStyle, flexGrow: 1 }} />
                          <button type="button" onClick={handleSelectFile} style={{ padding: '10px 14px', background: 'rgba(128,128,128,0.1)', border: '1px solid rgba(128,128,128,0.15)', color: 'var(--color-text-main)', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                            파일 탐색
                          </button>
                        </div>
                      </div>
                    )}

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

        {/* 플러그인 정보 수정 모달 팝업 */}
        {isEditModalOpen && (
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.3)', backdropFilter: 'blur(15px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000
          }} onClick={() => { setIsEditModalOpen(false); setTargetPluginId(null); setPluginWorkspaceDir(''); }}>
            <div style={{
              width: '360px', padding: '24px', borderRadius: '16px',
              background: 'var(--bg-modal)',
              border: 'var(--border-glass)', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
              display: 'flex', flexDirection: 'column', gap: '16px'
            }} onClick={e => e.stopPropagation()}>
              
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text-main)' }}>플러그인 정보 수정</div>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>별칭 이름, 트리거 컨텍스트 필터 및 작업 공간을 수정합니다.</p>
              </div>

              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>Plugin Alias</div>
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
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>Trigger Keywords (쉼표 구분)</div>
                <input
                  type="text"
                  value={keywordsInput}
                  onChange={e => setKeywordsInput(e.target.value)}
                  placeholder="예: 파일,메모,백업 (비워두면 상시 가동)"
                  style={inputStyle}
                />
              </div>

              {installedPlugins.find(p => p.id === targetPluginId)?.type !== 'remote' && (
                <div style={{ animation: 'fadeIn 0.2s ease-in-out' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>파일 작업 디렉토리(Workspace) 경로</div>
                  <input
                    type="text"
                    value={pluginWorkspaceDir}
                    onChange={e => setPluginWorkspaceDir(e.target.value)}
                    placeholder="지정 폴더 절대 경로 (미입력 시 격리 세팅 유지)"
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveEditPopup();
                      if (e.key === 'Escape') { setIsEditModalOpen(false); setTargetPluginId(null); setPluginWorkspaceDir(''); }
                    }}
                    style={inputStyle}
                  />
                </div>
              )}
              
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => { setIsEditModalOpen(false); setTargetPluginId(null); setPluginWorkspaceDir(''); }}
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