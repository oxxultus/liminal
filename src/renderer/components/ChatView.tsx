// src/renderer/components/ChatView.tsx
import React, { useState, useEffect, useRef } from 'react';
import { EngineConfig } from '../App';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// 💡 다크 모드와 라이트 모드 코드창의 명도 대비를 위해 두 테마를 모두 임포트합니다.
import { vscDarkPlus, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ChatViewProps {
  engines: EngineConfig[];
  activeEngine: EngineConfig;
  onProviderChange: (id: string) => void;
  sessionId: string;
  currentTitle?: string; 
  onTitleUpdate: (sessionId: string, newTitle: string) => void;
}

interface Message {
  id: string;
  sender: 'user' | 'bot' | 'system';
  text: string;
}

interface SlashCommand {
  command: string;
  description: string;
  icon: string;
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const SUMMARY_TRIGGER = 20;
const KEEP_RECENT = 6;

const SLASH_COMMANDS: SlashCommand[] = [
  { command: '/clear',   description: '현재 채팅 화면 초기화',        icon: '🗑️' },
  { command: '/summary', description: '현재 대화 요약 보기',           icon: '📋' },
  { command: '/engine',  description: '사용 중인 엔진 정보 보기',      icon: '⚙️' },
  { command: '/plugins', description: '활성화된 플러그인 목록 보기',   icon: '🔌' },
  { command: '/help',    description: '사용 가능한 커맨드 목록',       icon: '❓' },
];

export default function ChatView({ engines, activeEngine, onProviderChange, sessionId, currentTitle = '새 채팅', onTitleUpdate }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiConversation, setApiConversation] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // 💡 실시간 코드창 테마 스위칭을 위해 렌더러단의 다크모드 활성화 상태를 감지합니다.
  const [isDark, setIsDark] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark');

  // 슬래시 커맨드 관련 state
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredCommands = SLASH_COMMANDS.filter(c =>
    c.command.includes(slashFilter.toLowerCase())
  );

  // 전역 DOM의 테마 가동 스위치 변경 리스너 바인딩
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // 세션 변경 시 히스토리 + 요약본 로드
  useEffect(() => {
    const loadHistory = async () => {
      setIsLoadingHistory(true);
      setMessages([]);
      setApiConversation([]);
      try {
        const [history, summaryRow] = await Promise.all([
          window.electronAPI.getMessages(sessionId),
          window.electronAPI.getSummary(sessionId),
        ]);

        if (history && history.length > 0) {
          const uiMessages: Message[] = history.map((m: any) => ({
            id: m.id,
            sender: m.role === 'user' ? 'user' : m.role === 'assistant' ? 'bot' : 'system',
            text: m.content,
          }));
          setMessages(uiMessages);

          let apiHistory: any[] = [];
          if (summaryRow) {
            const afterSummary = history.filter(
              (m: any) => (m.role === 'user' || m.role === 'assistant') && m.timestamp > summaryRow.coveredUpTo
            );
            apiHistory = [
              { role: 'user', content: `[이전 대화 요약]\n${summaryRow.summary}` },
              { role: 'assistant', content: '알겠습니다. 이전 내용을 바탕으로 계속하겠습니다.' },
              ...afterSummary.map((m: any) => ({ role: m.role, content: m.content })),
            ];
          } else {
            apiHistory = history
              .filter((m: any) => m.role === 'user' || m.role === 'assistant')
              .map((m: any) => ({ role: m.role, content: m.content }));
          }
          setApiConversation(apiHistory);
        } else {
          setMessages([{
            id: generateId(), sender: 'bot',
            text: `안녕하세요! ${activeEngine?.name ?? 'AI'}입니다. 무엇을 도와드릴까요?`,
          }]);
        }
      } catch (e) {
        console.error('히스토리 로드 실패', e);
      } finally {
        setIsLoadingHistory(false);
      }
    };
    loadHistory();
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleClick = () => setShowSlashMenu(false);
    if (showSlashMenu) document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showSlashMenu]);

  const saveMessage = async (role: 'user' | 'assistant' | 'system', content: string) => {
    const id = generateId();
    await window.electronAPI.saveMessage({ id, sessionId, role, content });
    return id;
  };

  const updateSessionTitle = async (firstUserText: string) => {
    const title = firstUserText.length > 28 ? firstUserText.slice(0, 28) + '…' : firstUserText;
    await window.electronAPI.updateChatSessionTitle?.({ sessionId, title }).catch(() => {});
    onTitleUpdate(sessionId, title);
  };

  const executeSlashCommand = async (command: string) => {
    setInput('');
    setShowSlashMenu(false);

    switch (command) {
      case '/clear':
        setMessages([{
          id: generateId(), sender: 'bot',
          text: `채팅이 초기화되었습니다. ${activeEngine?.name ?? 'AI'}와 새로운 대화를 시작하세요.`,
        }]);
        setApiConversation([]);
        break;

      case '/summary': {
        const summaryRow = await window.electronAPI.getSummary(sessionId).catch(() => null);
        if (summaryRow) {
          setMessages(prev => [...prev, {
            id: generateId(), sender: 'system',
            text: `📋 [저장된 요약]\n${summaryRow.summary}`,
          }]);
        } else if (apiConversation.length > 0) {
          setIsSummarizing(true);
          try {
            const res = await window.electronAPI.sendChat({
              engine: activeEngine,
              apiKey: activeEngine.apiKey,
              messages: [
                ...apiConversation,
                { role: 'user', content: '지금까지의 대화를 5문장 이내로 요약해줘. 요약문만 출력해.' },
              ],
            });
            const text = res.data?.text ?? '요약 실패';
            setMessages(prev => [...prev, { id: generateId(), sender: 'system', text: `📋 [즉석 요약]\n${text}` }]);
          } finally {
            setIsSummarizing(false);
          }
        } else {
          setMessages(prev => [...prev, { id: generateId(), sender: 'system', text: '📋 요약할 대화 내용이 없습니다.' }]);
        }
        break;
      }

      case '/engine':
        setMessages(prev => [...prev, {
          id: generateId(), sender: 'system',
          text: `⚙️ [현재 엔진 정보]\n` +
                `이름: ${activeEngine?.name}\n` +
                `Provider: ${activeEngine?.provider}\n` +
                `모델: ${activeEngine?.model}\n` +
                `대화 히스토리: ${apiConversation.filter(m => m.role === 'user' || m.role === 'assistant').length}개`,
        }]);
        break;

      case '/plugins': {
        const pluginList = await window.electronAPI.getMcpPluginsList().catch(() => []);
        if (pluginList.length === 0) {
          setMessages(prev => [...prev, {
            id: generateId(), sender: 'system',
            text: '🔌 활성화된 플러그인이 없습니다.\nPlugin Manager에서 플러그인을 추가하세요.',
          }]);
        } else {
          const lines = pluginList.map((p: any) =>
            `${p.enabled ? '🟢' : '🔴'} ${p.name}  (${p.type === 'remote' ? '원격' : '로컬'})`
          ).join('\n');
          setMessages(prev => [...prev, {
            id: generateId(), sender: 'system',
            text: `🔌 [플러그인 목록 — ${pluginList.length}개]\n${lines}`,
          }]);
        }
        break;
      }

      case '/help':
        setMessages(prev => [...prev, {
          id: generateId(), sender: 'system',
          text: `❓ [사용 가능한 커맨드]\n` +
                SLASH_COMMANDS.map(c => `${c.icon} ${c.command}  —  ${c.description}`).join('\n'),
        }]);
        break;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);

    if (val === '/') {
      setShowSlashMenu(true);
      setSlashFilter('');
      setSelectedIndex(0);
    } else if (val.startsWith('/') && !val.includes(' ')) {
      setShowSlashMenu(true);
      setSlashFilter(val);
      setSelectedIndex(0);
    } else {
      setShowSlashMenu(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSlashMenu && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        executeSlashCommand(filteredCommands[selectedIndex].command);
        return;
      }
      if (e.key === 'Escape') {
        setShowSlashMenu(false);
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        setInput(filteredCommands[selectedIndex].command);
        setShowSlashMenu(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const compressWithSummary = async (history: any[]): Promise<any[]> => {
    const toSummarize = history.slice(0, history.length - KEEP_RECENT);
    const recent = history.slice(-KEEP_RECENT);

    const summaryTarget = toSummarize.filter(
      m => !(m.role === 'user' && m.content?.startsWith('[이전 대화 요약]')) &&
           !(m.role === 'assistant' && m.content === '알겠습니다. 이전 내용을 바탕으로 계속하겠습니다.')
    );
    if (summaryTarget.length === 0) return history;

    setIsSummarizing(true);
    try {
      const summaryRes = await window.electronAPI.sendChat({
        engine: activeEngine,
        apiKey: activeEngine.apiKey,
        messages: [
          ...summaryTarget,
          { role: 'user', content: '위 대화 내용을 핵심 정보 위주로 5문장 이내로 요약해줘. 요약문만 출력하고 다른 말은 하지 마.' },
        ],
      });

      if (!summaryRes.success) throw new Error('요약 실패');
      const summaryText = summaryRes.data?.text ?? '';

      const allMessages = await window.electronAPI.getMessages(sessionId);
      const coveredUpTo = allMessages.length > KEEP_RECENT
        ? allMessages[allMessages.length - KEEP_RECENT - 1]?.timestamp ?? Date.now()
        : Date.now();

      await window.electronAPI.saveSummary({ id: generateId(), sessionId, summary: summaryText, coveredUpTo });

      return [
        { role: 'user', content: `[이전 대화 요약]\n${summaryText}` },
        { role: 'assistant', content: '알겠습니다. 이전 내용을 바탕으로 계속하겠습니다.' },
        ...recent,
      ];
    } catch (e) {
      console.error('요약 압축 실패, 폴백:', e);
      return history.slice(-KEEP_RECENT * 2);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    if (input.startsWith('/')) {
      const matched = SLASH_COMMANDS.find(c => c.command === input.trim());
      if (matched) { executeSlashCommand(matched.command); return; }
    }
    if (!activeEngine?.apiKey) {
      alert(`${activeEngine?.name}의 API Key가 설정되지 않았습니다.`);
      return;
    }

    const userText = input.trim();
    
    const isFirstUserMessage = !apiConversation.some(m => m.role === 'user');
    const isDefaultTitle = currentTitle === '새 채팅'; 
    const shouldUpdateTitle = isFirstUserMessage && isDefaultTitle;

    setMessages(prev => [...prev, { id: generateId(), sender: 'user', text: userText }]);
    setInput('');
    setLoading(true);

    try {
      await saveMessage('user', userText);
      if (shouldUpdateTitle) {
        await updateSessionTitle(userText);
      }

      let updatedHistory = [...apiConversation, { role: 'user', content: userText }];
      if (apiConversation.length >= SUMMARY_TRIGGER) {
        updatedHistory = await compressWithSummary(updatedHistory);
      }

      const rawTools: any[] = await window.electronAPI.getMcpTools();
      const toolsByProvider: Record<string, any[]> = {
        anthropic: rawTools.map(t => ({ name: t.name, description: t.description, input_schema: t.input_schema })),
        openai: rawTools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } })),
        google: rawTools.length > 0 ? [{ functionDeclarations: rawTools.map(t => ({ name: t.name, description: t.description, parameters: t.input_schema })) }] : [],
      };
      const tools = toolsByProvider[activeEngine.provider] ?? [];

      const proxyRes = await window.electronAPI.sendChat({
        engine: activeEngine, 
        messages: updatedHistory,
        apiKey: activeEngine.apiKey,
        tools: tools.length > 0 ? tools : undefined,
      });

      if (!proxyRes.success) throw new Error(proxyRes.error);

      const botResponseText = proxyRes.data?.text || '';
      if (botResponseText) {
        setMessages(prev => [...prev, { id: generateId(), sender: 'bot', text: botResponseText }]);
        await saveMessage('assistant', botResponseText);
        
        if (activeEngine.provider === 'openai' && proxyRes.data.rawMessage) {
          updatedHistory.push(proxyRes.data.rawMessage);
        } else {
          updatedHistory.push({ role: 'assistant', content: botResponseText });
        }
      }
      setApiConversation(updatedHistory);

    } catch (error: any) {
      console.error("Renderer Chat Error:", error);
      setMessages(prev => [...prev, { id: generateId(), sender: 'bot', text: `❌ 에러: ${error.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', backgroundColor: 'transparent', overflow: 'hidden', boxSizing: 'border-box' }}>

      {/* 요약 진행 배너 */}
      {isSummarizing && (
        <div style={{ padding: '10px 20px', textAlign: 'center', background: 'rgba(128, 128, 128, 0.08)', borderBottom: '1px solid rgba(128,128,128,0.15)', fontSize: '0.8rem', color: 'var(--color-text-main)', fontWeight: 600 }}>
          ✦ 대화 내용을 요약하는 중입니다...
        </div>
      )}

      {/* 메시지 목록 피드 */}
      <div style={{ flexGrow: 1, width: '100%', padding: '30px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px' }}>
        {isLoadingHistory ? (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '40px', fontWeight: 500 }}>대화 기록 불러오는 중...</div>
        ) : (
          <div style={{ width: '100%', maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              
              if (msg.sender === 'system') return (
                <div key={msg.id} style={{ alignSelf: 'center', fontSize: '0.85rem', color: 'var(--color-text-main)', fontWeight: 600, padding: '10px 16px', borderRadius: '12px', border: 'var(--border-glass)', background: 'rgba(128,128,128,0.06)', whiteSpace: 'pre-wrap', maxWidth: '90%', lineHeight: 1.6 }}>
                  {msg.text}
                </div>
              );
              
              return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                  {!isUser && (
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text-muted)', padding: '0 4px', marginBottom: '2px', letterSpacing: '0.02em' }}>
                      {activeEngine?.name}
                    </span>
                  )}
                  
                  <div style={{ 
                    padding: '13px 18px', 
                    borderRadius: isUser ? '18px 4px 18px 18px' : '4px 18px 18px 18px', 
                    // 💡 유저 말풍선 명도 조절 및 가변 테마 할당
                    backgroundColor: isUser ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)') : 'var(--bg-glass-card)', 
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: 'var(--border-glass)', 
                    color: 'var(--color-text-main)', 
                    fontWeight: 500, 
                    maxWidth: '85%', 
                    lineHeight: 1.6, 
                    fontSize: '0.95rem', 
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.02)',
                  }}>
                    {isUser ? (
                      <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.text}</div>
                    ) : (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          code({ node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '');
                            return !inline && match ? (
                              <div style={{ borderRadius: '8px', overflow: 'hidden', margin: '12px 0', fontSize: '0.88rem', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                                <SyntaxHighlighter
                                  // 💡 현재 렌더러단 모드 스코프에 맞춰 코드창 테마를 동적으로 스위칭합니다.
                                  style={(isDark ? vscDarkPlus : prism) as any}
                                  language={match[1]}
                                  PreTag="div"
                                  {...props}
                                >
                                  {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                              </div>
                            ) : (
                              <code style={{ background: 'rgba(128,128,128,0.1)', padding: '2px 5px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.9em', fontWeight: 600, color: 'var(--color-text-main)' }} {...props}>
                                {children}
                              </code>
                            );
                          },
                          a: ({ href, children }) => (
                            <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc', fontWeight: 700, textDecoration: 'underline' }}>{children}</a>
                          ),
                          ul: ({ children }) => <ul style={{ paddingLeft: '20px', margin: '6px 0' }}>{children}</ul>,
                          ol: ({ children }) => <ol style={{ paddingLeft: '20px', margin: '6px 0' }}>{children}</ol>,
                          li: ({ children }) => <li style={{ marginBottom: '4px' }}>{children}</li>,
                          p: ({ children }) => <p style={{ margin: '4px 0 8px 0', wordBreak: 'break-word' }}>{children}</p>
                        }}
                      >
                        {msg.text}
                      </ReactMarkdown>
                    )}
                  </div>
                </div>
              );
            })}
            
            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text-muted)', padding: '0 4px' }}>{activeEngine?.name}</span>
                <div style={{ padding: '12px 20px', borderRadius: '16px', backgroundColor: 'var(--bg-glass-card)', border: 'var(--border-glass)' }}>
                  <span style={{ display: 'inline-flex', gap: '5px', alignItems: 'center' }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-text-main)', display: 'inline-block', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 입력 패널 영역 */}
      <div style={{ padding: '16px 20px 30px 20px', display: 'flex', justifyContent: 'center', position: 'relative' }}>
        <div style={{ width: '100%', maxWidth: '720px', position: 'relative' }}>

          {/* 슬래시 커맨드 팝업 메뉴 */}
          {showSlashMenu && filteredCommands.length > 0 && (
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute', bottom: 'calc(100% + 10px)', left: 0, right: 0,
                background: 'var(--bg-bubble-bot)', 
                border: 'var(--border-glass)', 
                borderRadius: '16px', overflow: 'hidden',
                backdropFilter: 'blur(30px)',
                WebkitBackdropFilter: 'blur(30px)',
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.15)',
                zIndex: 100,
              }}
            >
              <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(128,128,128,0.1)', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 700, letterSpacing: '0.04em', backgroundColor: 'rgba(128,128,128,0.03)' }}>
                커맨드 — ↑↓ 이동 · Enter 실행 · Tab 자동완성 · Esc 닫기
              </div>
              {filteredCommands.map((cmd, idx) => (
                <div
                  key={cmd.command}
                  onClick={() => executeSlashCommand(cmd.command)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 16px', cursor: 'pointer',
                    backgroundColor: idx === selectedIndex ? 'rgba(128,128,128,0.06)' : 'transparent',
                    borderLeft: idx === selectedIndex ? '4px solid var(--color-text-main)' : '4px solid transparent',
                    transition: 'all 0.1s ease',
                  }}
                >
                  <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{cmd.icon}</span>
                  <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-text-main)', fontFamily: 'monospace' }}>
                    {cmd.command}
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                    {cmd.description}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 메인 인풋 박스 */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px', 
            backgroundColor: 'var(--bg-input)', 
            borderRadius: '24px', 
            padding: '6px 8px 6px 18px', 
            backdropFilter: 'blur(30px)', 
            WebkitAppRegion: 'no-drag',
            border: showSlashMenu ? '1px solid var(--color-text-main)' : 'var(--border-glass)', 
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.04)',
            transition: 'border-color 0.2s, box-shadow 0.2s' 
          }}>
            <input
              ref={inputRef}
              type="text" value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={loading ? '응답 대기 중...' : `${activeEngine?.name ?? 'AI'}에게 명령 · /로 커맨드`}
              disabled={loading}
              style={{ flexGrow: 1, padding: '8px 0', border: 'none', background: 'transparent', color: 'var(--color-text-main)', fontWeight: 500, outline: 'none', fontSize: '0.95rem' }}
            />
            <select value={activeEngine?.id ?? ''} onChange={(e) => onProviderChange(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-main)', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem', outline: 'none', paddingRight: '4px' }}>
              {engines.map(eng => <option key={eng.id} value={eng.id} style={{ background: 'var(--bg-input)', color: 'var(--color-text-main)' }}>{eng.name}</option>)}
            </select>
            <button
              onClick={handleSend} disabled={loading || !input.trim()}
              style={{ 
                width: '36px', 
                height: '36px', 
                borderRadius: '50%', 
                border: 'none', 
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', 
                padding: '0', 
                background: loading || !input.trim() ? 'rgba(128,128,128,0.1)' : 'var(--color-text-main)', 
                color: loading || !input.trim() ? 'var(--color-text-muted)' : 'var(--bg-input)', 
                fontSize: '1.1rem', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                transition: 'all 0.15s ease',
              }}
            >↑</button>
          </div>
        </div>
      </div>

    </div>
  );
}