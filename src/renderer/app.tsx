// src/renderer/App.tsx
import React, { useState, useEffect } from 'react';
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

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    await window.electronAPI.deleteSession(sessionId);
    const remaining = sessions.filter(s => s.id !== sessionId);
    setSessions(remaining);
    if (activeSessionId === sessionId) {
      setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const activeEngine = engines.find(e => e.id === activeEngineId) || engines[0];

  const menuItems = [
    { view: 'chat' as const,     Icon: Icon.Chat,     label: 'Chat Workspace' },
    { view: 'plugins' as const,  Icon: Icon.Plugin,   label: 'Plugin Manager' },
    { view: 'settings' as const, Icon: Icon.Settings, label: 'Customize Setup' },
  ];

  return (
    <div style={{
      display: 'flex', width: '100vw', height: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      
      /* 🤍 차분한 다크 소프트 엠버 그레이 텍스트 및 프레임 매핑 */
      color: '#2D2D35',
      background: 'linear-gradient(135deg, #F9F9FB 0%, #F4F4F6 50%, #EAEAEF 100%)',
      position: 'relative', borderRadius: '14px', overflow: 'hidden',
      border: '1px solid rgba(0, 0, 0, 0.06)',
    }}>

      {/* ── 사이드바 ── */}
      <div style={{
        width: isSidebarOpen ? '240px' : '0px',
        minWidth: isSidebarOpen ? '240px' : '0px',
        opacity: isSidebarOpen ? 1 : 0,
        pointerEvents: isSidebarOpen ? 'auto' : 'none',
        
        /* 🤍 오프화이트 레이어 안개 굴절 효과 */
        backgroundColor: 'rgba(244, 244, 246, 0.4)',
        backdropFilter: 'blur(40px)',
        borderRight: isSidebarOpen ? '1px solid rgba(0, 0, 0, 0.05)' : 'none',
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
              background: '#2D2D35',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.8rem', fontWeight: 'bold', color: '#F9F9FB', flexShrink: 0,
            }}>U</div>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#2D2D35', whiteSpace: 'nowrap' }}>oxxultus</span>
          </div>

          {/* 새 채팅 버튼 */}
          <button
            onClick={handleNewChat}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              width: '100%', padding: '10px 14px', borderRadius: '10px', marginBottom: '16px',
              background: 'rgba(0, 0, 0, 0.03)',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              color: '#2D2D35', fontSize: '0.85rem', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s ease', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.06)'; e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.03)'; e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.08)'; }}
          >
            <Icon.Plus /> 새 채팅
          </button>

          {/* 채팅 세션 목록 */}
          {sessions.length > 0 && (
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', marginBottom: '12px' }}>
              <div style={{
                fontSize: '0.68rem', fontWeight: 700, color: '#9E9EAF',
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
                        backgroundColor: isActive ? 'rgba(0, 0, 0, 0.04)' : isHovered ? 'rgba(0, 0, 0, 0.02)' : 'transparent',
                        color: isActive ? '#2D2D35' : '#6E6E7A',
                        fontSize: '0.82rem', fontWeight: isActive ? 600 : 400,
                        cursor: 'pointer',
                        border: isActive ? '1px solid rgba(0, 0, 0, 0.03)' : '1px solid transparent',
                        transition: 'all 0.12s ease', boxSizing: 'border-box',
                      }}
                      onClick={() => { setActiveSessionId(session.id); setCurrentView('chat'); }}
                      onMouseEnter={() => setHoveredSessionId(session.id)}
                      onMouseLeave={() => setHoveredSessionId(null)}
                    >
                      <span style={{ flexShrink: 0, opacity: 0.6 }}><Icon.MessageCircle /></span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {session.title}
                      </span>
                      {(isHovered || isActive) && (
                        <button
                          onClick={(e) => handleDeleteSession(e, session.id)}
                          style={{
                            background: 'transparent', border: 'none',
                            color: '#9E9EAF', cursor: 'pointer',
                            padding: '2px', borderRadius: '4px', flexShrink: 0,
                            display: 'flex', alignItems: 'center', transition: 'color 0.1s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#9E9EAF')}
                          title="삭제"
                        ><Icon.Trash /></button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ height: '1px', background: 'rgba(0, 0, 0, 0.06)', margin: '0 4px 12px', flexShrink: 0 }} />

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
                    backgroundColor: isActive ? 'rgba(0, 0, 0, 0.04)' : 'transparent',
                    color: isActive ? '#2D2D35' : '#6E6E7A',
                    fontSize: '0.85rem', fontWeight: isActive ? 600 : 400,
                    border: isActive ? '1px solid rgba(0, 0, 0, 0.02)' : '1px solid transparent',
                    cursor: 'pointer', transition: 'all 0.12s ease', textAlign: 'left',
                  }}
                  onMouseEnter={e => { if (!isActive) { e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.02)'; e.currentTarget.style.color = '#2D2D35'; } }}
                  onMouseLeave={e => { if (!isActive) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#6E6E7A'; } }}
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
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        backdropFilter: 'blur(20px)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* 드래그 헤더 */}
        <div style={{
          height: '52px', minHeight: '52px', position: 'relative',
          borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
          backgroundColor: 'rgba(255, 255, 255, 0.3)',
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
            display: 'flex', alignItems: 'center', zIndex: 10,
          }}>
            <button
              onClick={() => setIsSidebarOpen(prev => !prev)}
              style={{
                background: 'rgba(0, 0, 0, 0.02)', border: '1px solid rgba(0, 0, 0, 0.05)',
                color: '#6E6E7A', cursor: 'pointer',
                padding: '6px 8px', borderRadius: '8px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)'; e.currentTarget.style.color = '#2D2D35'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0, 0, 0, 0.02)'; e.currentTarget.style.color = '#6E6E7A'; }}
            >
              {isSidebarOpen ? <Icon.PanelClose /> : <Icon.PanelOpen />}
            </button>
          </div>

          {/* 타이틀 */}
          <div style={{
            position: 'absolute', left: '50%', transform: 'translateX(-50%)',
            fontSize: '0.82rem', fontWeight: 600, color: '#6E6E7A',
            pointerEvents: 'none', whiteSpace: 'nowrap',
          }}>
            AI 사랑해 Client
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
                onTitleUpdate={loadSessions}
              />
            ) : (
              <div style={{ textAlign: 'center', color: '#6E6E7A' }}>
                <div style={{ fontSize: '1rem', marginBottom: '8px', color: '#2D2D35', fontWeight: 600 }}>새 채팅을 시작하세요</div>
                <button
                  onClick={handleNewChat}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '10px 24px', borderRadius: '10px',
                    background: 'rgba(0, 0, 0, 0.03)',
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                    color: '#2D2D35', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
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
    </div>
  );
}