// src/renderer/App.tsx
import React, { useState, useEffect, useRef } from 'react';
import ChatView from './components/ChatView';
import SettingsView from './components/SettingsView';
import PluginsView from './components/PluginsView';

export interface EngineConfig {
  id: string;
  name: string;
  provider: 'anthropic' | 'openai' | 'google';
  url: string;
  model: string;
  apiKey: string;
}

export interface ChatSession {
  id: string;
  title: string;
  engineId: string;
  updatedAt: number;
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const Icon = {
  PanelClose: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><polyline points="15 9 12 12 15 15"/>
    </svg>
  ),
  PanelOpen: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><polyline points="12 9 15 12 12 15"/>
    </svg>
  ),
  Chat: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  Plugin: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/>
    </svg>
  ),
  Settings: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  Plus: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  Trash: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  ),
  MessageCircle: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  Edit: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4L18.5 2.5z"/>
    </svg>
  ),
  More: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
    </svg>
  ),
  // 💡 [테마 아이콘 추가] 해/달 토글 스위치용 SVG
  Sun: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.36" x2="5.64" y2="17.94"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
    </svg>
  ),
  Moon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
};

export default function App() {
  const [currentView, setCurrentView] = useState<'chat' | 'settings' | 'plugins'>('chat');
  const [engines, setEngines] = useState<EngineConfig[]>([]);
  const [activeEngineId, setActiveEngineId] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);

  // 더보기 컨텍스트 메뉴용 제어 상태
  const [menuOpenSessionId, setMenuOpenSessionId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  // 이름 변경 모달 팝업 상태 트래커
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [targetRenameSessionId, setTargetRenameSessionId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState<string>('');

  // 💡 [신규 추가] 다크모드 영속성 제어 스위치 (기본값 로컬스토리지 연동)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  const loadEngines = async () => {
    setIsLoading(true);
    const loadedEngines = await window.electronAPI.getEngines();
    if (loadedEngines && loadedEngines.length > 0) {
      setEngines(loadedEngines);
      if (!activeEngineId) setActiveEngineId(loadedEngines[0].id);
    }
    setIsLoading(false);
  };

  const loadSessions = async () => {
    const loaded: ChatSession[] = await window.electronAPI.getSessions();
    setSessions(loaded || []);
    if (loaded && loaded.length > 0 && !activeSessionId) {
      setActiveSessionId(loaded[0].id);
    }
  };

  useEffect(() => { loadEngines(); loadSessions(); }, []);

  // 💡 [신규 추가] 테마 상태 바뀔 때마다 최상위 document 노드에 다크모드 클래스 및 CSS 변수 바인딩
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  // 외부 클릭 시 컨텍스트 메뉴 닫기 유틸리티
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenSessionId(null);
      }
    };
    if (menuOpenSessionId) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [menuOpenSessionId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        setIsSidebarOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNewChat = async () => {
    const newId = generateId();
    const engineId = activeEngineId || engines[0]?.id || '';
    await window.electronAPI.createSession({ id: newId, title: '새 채팅', engineId });
    await loadSessions();
    setActiveSessionId(newId);
    setCurrentView('chat');
  };

  const handleDeleteSession = async (sessionId: string) => {
    await window.electronAPI.deleteSession(sessionId);
    const remaining = sessions.filter(s => s.id !== sessionId);
    setSessions(remaining);
    if (activeSessionId === sessionId) {
      setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
    }
    setMenuOpenSessionId(null);
  };

  const handleStartRenameModal = (id: string, currentTitle: string) => {
    setTargetRenameSessionId(id);
    setEditTitleInput(currentTitle);
    setIsRenameModalOpen(true);
    setMenuOpenSessionId(null);
  };

  const handleSaveRenamePopup = async () => {
    if (!targetRenameSessionId || !editTitleInput.trim()) {
      setIsRenameModalOpen(false);
      return;
    }
    await window.electronAPI.updateChatSessionTitle?.({ sessionId: targetRenameSessionId, title: editTitleInput.trim() }).catch(() => {});
    setSessions(prev => prev.map(s => s.id === targetRenameSessionId ? { ...s, title: editTitleInput.trim() } : s));
    setIsRenameModalOpen(false);
    setTargetRenameSessionId(null);
  };

  const handleOpenMenu = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (menuOpenSessionId === sessionId) {
      setMenuOpenSessionId(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuPosition({ top: rect.bottom + 4, left: rect.left - 75 });
    setMenuOpenSessionId(sessionId);
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const activeEngine = engines.find(e => e.id === activeEngineId) || engines[0];

  const menuItems = [
    { view: 'chat' as const,     Icon: Icon.Chat,     label: 'Chat' },
    { view: 'plugins' as const,  Icon: Icon.Plugin,   label: 'MCP Plugins' },
    { view: 'settings' as const, Icon: Icon.Settings, label: 'Engine Setup' },
  ];

  return (
    <div style={{
      display: 'flex', width: '100vw', height: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      
      // 💡 [테마 연동 가변 색상 제어]
      color: isDarkMode ? '#EAEAEF' : '#2D2D35',
      background: isDarkMode 
        ? 'linear-gradient(135deg, #16161A 0%, #1A1A22 50%, #121216 100%)' 
        : 'linear-gradient(135deg, #F9F9FB 0%, #F4F4F6 50%, #EAEAEF 100%)',
      position: 'relative', borderRadius: '14px', overflow: 'hidden',
      border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(0, 0, 0, 0.06)',
    }}>

      {/* ── 사이드바 ── */}
      <div style={{
        width: isSidebarOpen ? '240px' : '0px',
        minWidth: isSidebarOpen ? '240px' : '0px',
        opacity: isSidebarOpen ? 1 : 0,
        pointerEvents: isSidebarOpen ? 'auto' : 'none',
        // 💡 다크 모드 시 투명 어두운 안개 글래스 이식
        backgroundColor: isDarkMode ? 'rgba(22, 22, 26, 0.45)' : 'rgba(244, 244, 246, 0.4)',
        backdropFilter: 'blur(40px)',
        borderRight: isSidebarOpen ? (isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0, 0, 0, 0.05)') : 'none',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.28s cubic-bezier(0.4,0,0.2,1), min-width 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease',
        zIndex: 10, overflow: 'hidden',
        flexShrink: 0,
      }}>
        <div style={{ width: '240px', height: '100%', display: 'flex', flexDirection: 'column', padding: '0 12px 20px', boxSizing: 'border-box' }}>

          {/* 로고 영역 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '4px', marginTop: '44px', marginBottom: '12px', flexShrink: 0 }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '8px',
              background: isDarkMode ? '#EAEAEF' : '#2D2D35',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.8rem', fontWeight: 'bold', color: isDarkMode ? '#16161A' : '#F9F9FB', flexShrink: 0,
            }}>U</div>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: isDarkMode ? '#EAEAEF' : '#2D2D35', whiteSpace: 'nowrap' }}>oxxultus</span>
          </div>

          {/* 새 채팅 버튼 */}
          <button
            onClick={handleNewChat}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              width: '100%', padding: '10px 14px', borderRadius: '10px', marginBottom: '16px',
              background: isDarkMode ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
              border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
              color: isDarkMode ? '#EAEAEF' : '#2D2D35', fontSize: '0.85rem', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s ease', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0, 0, 0, 0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0, 0, 0, 0.03)'; }}
          >
            <Icon.Plus /> 새 채팅
          </button>

          {/* 채팅 세션 목록 */}
          {sessions.length > 0 && (
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', marginBottom: '12px' }}>
              <div style={{
                fontSize: '0.68rem', fontWeight: 700, color: isDarkMode ? '#6E6E7A' : '#9E9EAF',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                padding: '0 6px', marginBottom: '6px',
              }}>채팅 기록</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                {sessions.map(session => {
                  const isActive = activeSessionId === session.id;
                  const isHovered = hoveredSessionId === session.id;
                  
                  return (
                    <div
                      key={session.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        width: '100%', padding: '8px 10px', borderRadius: '8px',
                        backgroundColor: isActive 
                          ? (isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)') 
                          : isHovered ? (isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0, 0, 0, 0.02)') : 'transparent',
                        color: isActive ? (isDarkMode ? '#FFFFFF' : '#2D2D35') : (isDarkMode ? '#9E9EAF' : '#6E6E7A'),
                        fontSize: '0.82rem', fontWeight: isActive ? 600 : 400,
                        cursor: 'pointer',
                        border: isActive ? (isDarkMode ? '1px solid rgba(255,255,255,0.03)' : '1px solid rgba(0, 0, 0, 0.03)') : '1px solid transparent',
                        transition: 'all 0.12s ease', boxSizing: 'border-box',
                        height: '34px', position: 'relative'
                      }}
                      onClick={() => { setActiveSessionId(session.id); setCurrentView('chat'); }}
                      onMouseEnter={() => setHoveredSessionId(session.id)}
                      onMouseLeave={() => setHoveredSessionId(null)}
                    >
                      <span style={{ flexShrink: 0, opacity: 0.6 }}><Icon.MessageCircle /></span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, paddingRight: '20px' }}>
                        {session.title}
                      </span>

                      {(isHovered || isActive || menuOpenSessionId === session.id) && (
                        <button
                          onClick={(e) => handleOpenMenu(e, session.id)}
                          style={{
                            position: 'absolute', right: '8px',
                            background: 'transparent', border: 'none',
                            color: menuOpenSessionId === session.id ? (isDarkMode ? '#FFF' : '#2D2D35') : '#9E9EAF', 
                            cursor: 'pointer', padding: '4px', borderRadius: '4px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <Icon.More />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ height: '1px', background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0, 0, 0, 0.06)', margin: '0 4px 12px', flexShrink: 0 }} />

          {/* 내비게이션 메뉴 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
            {menuItems.map(({ view, Icon: Ic, label }) => {
              const isActive = currentView === view;
              return (
                <button
                  key={view}
                  onClick={() => setCurrentView(view)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    width: '100%', padding: '10px 12px', borderRadius: '9px',
                    backgroundColor: isActive ? (isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0, 0, 0, 0.04)') : 'transparent',
                    color: isActive ? (isDarkMode ? '#FFFFFF' : '#2D2D35') : (isDarkMode ? '#9E9EAF' : '#6E6E7A'),
                    fontSize: '0.85rem', fontWeight: isActive ? 600 : 400,
                    border: isActive ? '1px solid rgba(0, 0, 0, 0.02)' : '1px solid transparent',
                    cursor: 'pointer', transition: 'all 0.12s ease', textAlign: 'left',
                  }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0, 0, 0, 0.02)'; } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.backgroundColor = 'transparent'; } }}
                >
                  <span style={{ opacity: isActive ? 1 : 0.7, flexShrink: 0 }}><Ic /></span>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 메인 영역 ── */}
      <div style={{
        flexGrow: 1, height: '100%', minWidth: 0,
        backgroundColor: isDarkMode ? 'rgba(22, 22, 26, 0.1)' : 'rgba(255, 255, 255, 0.15)',
        backdropFilter: 'blur(20px)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* 드래그 헤더 */}
        <div style={{
          height: '52px', minHeight: '52px', position: 'relative',
          borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0, 0, 0, 0.05)',
          backgroundColor: isDarkMode ? 'rgba(22, 22, 26, 0.3)' : 'rgba(255, 255, 255, 0.3)',
          // @ts-ignore
          WebkitAppRegion: 'drag',
          display: 'flex', alignItems: 'center',
          paddingLeft: isSidebarOpen ? '16px' : '84px',
          paddingRight: '16px',
        }}>
          {/* 토글 버튼 */}
          <div style={{
            // @ts-ignore
            WebkitAppRegion: 'no-drag',
            display: 'flex', alignItems: 'center', gap: '8px', zIndex: 10,
          }}>
            <button
              onClick={() => setIsSidebarOpen(prev => !prev)}
              style={{
                background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0, 0, 0, 0.02)', 
                border: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0, 0, 0, 0.05)',
                color: '#6E6E7A', cursor: 'pointer',
                padding: '6px 8px', borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              {isSidebarOpen ? <Icon.PanelClose /> : <Icon.PanelOpen />}
            </button>

            {/* 💡 [테마 전환 스위치 단추 심기] */}
            <button
              onClick={() => setIsDarkMode(prev => !prev)}
              title={isDarkMode ? "라이트 모드로 전환" : "다크 모드로 전환"}
              style={{
                background: isDarkMode ? 'rgba(255,255,255,0.02)' : 'rgba(0, 0, 0, 0.02)', 
                border: isDarkMode ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0, 0, 0, 0.05)',
                color: isDarkMode ? '#f59e0b' : '#6E6E7A', cursor: 'pointer',
                padding: '6px 8px', borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              {isDarkMode ? <Icon.Sun /> : <Icon.Moon />}
            </button>
          </div>

          {/* 타이틀 */}
          <div style={{
            position: 'absolute', left: '50%', transform: 'translateX(-50%)',
            fontSize: '0.82rem', fontWeight: 600, color: '#6E6E7A',
            pointerEvents: 'none', whiteSpace: 'nowrap',
          }}>
            Liminal Desktop
          </div>
        </div>

        {/* 뷰 컨텐츠 */}
        <div style={{ flexGrow: 1, overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          {isLoading ? (
            <div style={{ color: '#6E6E7A', fontSize: '0.9rem' }}>엔진 설정 로드 중...</div>
          ) : currentView === 'chat' ? (
            activeSessionId ? (
              <ChatView
                key={activeSessionId}
                engines={engines}
                activeEngine={activeEngine}
                onProviderChange={setActiveEngineId}
                sessionId={activeSessionId}
                currentTitle={activeSession?.title} 
                onTitleUpdate={loadSessions}
              />
            ) : (
              <div style={{ textAlign: 'center', color: '#6E6E7A' }}>
                <div style={{ fontSize: '1rem', marginBottom: '8px', color: isDarkMode ? '#FFF' : '#2D2D35', fontWeight: 600 }}>새 채팅을 시작하세요</div>
                <button
                  onClick={handleNewChat}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '10px 24px', borderRadius: '10px',
                    background: isDarkMode ? 'rgba(255,255,255,0.03)' : 'rgba(0, 0, 0, 0.03)',
                    border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
                    color: isDarkMode ? '#FFF' : '#2D2D35', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                  }}
                ><Icon.Plus /> 새 채팅 시작</button>
              </div>
            )
          ) : currentView === 'plugins' ? (
            <PluginsView />
          ) : (
            <SettingsView engines={engines} activeEngine={activeEngine} onEngineChange={setActiveEngineId} onSave={loadEngines} />
          )}
        </div>
      </div>

      {/* ── 대화 기록 미니 컨텍스트 조작 메뉴 ── */}
      {menuOpenSessionId && (
        <div
          ref={menuRef}
          style={{
            position: 'absolute', top: menuPosition.top, left: menuPosition.left,
            backgroundColor: isDarkMode ? 'rgba(30, 30, 38, 0.98)' : 'rgba(255, 255, 255, 0.96)', 
            backdropFilter: 'blur(20px)',
            border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0, 0, 0, 0.12)', 
            borderRadius: '10px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)', padding: '4px', zIndex: 9999,
            display: 'flex', flexDirection: 'column', gap: '1px', width: '110px',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              const targetSession = sessions.find(s => s.id === menuOpenSessionId);
              if (targetSession) handleStartRenameModal(menuOpenSessionId, targetSession.title);
            }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px',
              border: 'none', background: 'transparent', borderRadius: '6px',
              fontSize: '0.78rem', fontWeight: 500, color: isDarkMode ? '#EAEAEF' : '#2D2D35', cursor: 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0, 0, 0, 0.04)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Icon.Edit /> 이름 변경
          </button>
          <button
            onClick={() => handleDeleteSession(menuOpenSessionId)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px',
              border: 'none', background: 'transparent', borderRadius: '6px',
              fontSize: '0.78rem', fontWeight: 500, color: '#ef4444', cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <Icon.Trash /> 삭제하기
          </button>
        </div>
      )}

      {/* ── 중앙 글래스모피즘 이름 변경 모달 팝업 레이어 ── */}
      {isRenameModalOpen && (
        <div style={{
          position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.3)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000
        }} onClick={() => setIsRenameModalOpen(false)}>
          <div style={{
            width: '320px', padding: '20px', borderRadius: '16px',
            background: isDarkMode 
              ? 'linear-gradient(135deg, rgba(30, 30, 38, 0.98) 0%, rgba(20, 20, 25, 0.95) 100%)'
              : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(245, 245, 250, 0.9) 100%)',
            border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0, 0, 0, 0.15)', 
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.2)',
            display: 'flex', flexDirection: 'column', gap: '14px'
          }} onClick={e => e.stopPropagation()}>
            
            <div style={{ fontSize: '0.92rem', fontWeight: 700, color: isDarkMode ? '#FFF' : '#2D2D35' }}>채팅방 이름 변경</div>
            
            <input
              type="text"
              value={editTitleInput}
              onChange={e => setEditTitleInput(e.target.value)}
              placeholder="변경할 이름을 입력하세요"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') handleSaveRenamePopup();
                if (e.key === 'Escape') setIsRenameModalOpen(false);
              }}
              style={{
                width: '100%', padding: '10px 12px', fontSize: '0.88rem',
                border: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0, 0, 0, 0.12)', 
                borderRadius: '8px', outline: 'none', 
                backgroundColor: isDarkMode ? 'rgba(0,0,0,0.2)' : '#FFFFFF', 
                color: isDarkMode ? '#FFF' : '#111111',
                boxSizing: 'border-box'
              }}
            />
            
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <button
                onClick={() => setIsRenameModalOpen(false)}
                style={{
                  padding: '8px 14px', border: 'none', background: 'rgba(0,0,0,0.05)',
                  borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, color: '#6E6E7A', cursor: 'pointer'
                }}
              >취소</button>
              <button
                onClick={handleSaveRenamePopup}
                disabled={!editTitleInput.trim()}
                style={{
                  padding: '8px 14px', border: 'none', background: isDarkMode ? '#EAEAEF' : '#2D2D35',
                  borderRadius: '6px', fontSize: '0.82rem', fontWeight: 600, color: isDarkMode ? '#16161A' : '#FFFFFF',
                  cursor: editTitleInput.trim() ? 'pointer' : 'not-allowed',
                  opacity: editTitleInput.trim() ? 1 : 0.5
                }}
              >저장</button>
            </div>

          </div>
        </div>
      )}

      {/* 전역 테마 주입을 위한 CSS Variables 스타일시트 하이재킹 */}
      <style>{`
        /* 💡 다크모드 시 자식 하위 뷰들이 가져다 쓸 전역 CSS 테마 변수 구축 */
        :root[data-theme='dark'] {
          --bg-glass-card: linear-gradient(135deg, rgba(30, 30, 38, 0.55) 0%, rgba(20, 20, 25, 0.35) 100%);
          --border-glass: 1px solid rgba(255, 255, 255, 0.06);
          --bg-input: rgba(0, 0, 0, 0.25);
          --color-text-main: #EAEAEF;
          --color-text-muted: #9E9EAF;
          --bg-bubble-bot: rgba(30, 30, 38, 0.7);
          /* ↓ 추가 */
          --bg-modal: rgba(28, 28, 36, 0.98);
          --border-glass-input: rgba(255, 255, 255, 0.14);
          --color-btn-text: #16161A;
        }
        :root[data-theme='light'] {
          --bg-glass-card: linear-gradient(135deg, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.2) 100%);
          --border-glass: 1px solid rgba(0, 0, 0, 0.08);
          --bg-input: rgba(255, 255, 255, 0.75);
          --color-text-main: #111111;
          --color-text-muted: #6E6E7A;
          --bg-bubble-bot: rgba(255, 255, 255, 0.65);
          /* ↓ 추가 */
          --bg-modal: rgba(255, 255, 255, 0.97);
          --border-glass-input: rgba(0, 0, 0, 0.12);
          --color-btn-text: #F9F9FB;
        }
        @keyframes pulse { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1.1); } }
      `}</style>
    </div>
  );
}