// src/renderer/components/ChatView.tsx
import React, { useState, useEffect, useRef } from 'react';
import { EngineConfig } from '../App';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, prism } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from 'framer-motion';

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
  sender: 'user' | 'bot';
  text: string;
}

interface SlashCommand {
  command: string;
  description: string;
  iconType: 'clear' | 'summary' | 'engine' | 'plugins' | 'help';
}

// 💡 [구조 확장] 단순 텍스트 출력을 넘어, 토스트 자체에 플러그인 리스트 객체를 직접 넘길 수 있도록 사양 정의
interface SystemToast {
  id: string;
  type: 'info' | 'plugins_report';
  text?: string;
  pluginList?: any[]; // /plugins 커맨드 대응용 원천 데이터 소켓
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const SUMMARY_TRIGGER = 20;
const KEEP_RECENT = 6;

const SLASH_COMMANDS: SlashCommand[] = [
  { command: '/clear',   description: '현재 채팅 화면 초기화',        iconType: 'clear' },
  { command: '/summary', description: '현재 대화 요약 보기',           iconType: 'summary' },
  { command: '/engine',  description: '사용 중인 엔진 정보 보기',      iconType: 'engine' },
  { command: '/plugins', description: '활성화된 플러그인 목록 보기',   iconType: 'plugins' },
  { command: '/help',    description: '사용 가능한 커맨드 목록',       iconType: 'help' },
];

const SvgIcon = {
  clear: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  ),
  summary: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  engine: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  plugins: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
    </svg>
  ),
  help: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  ),
  info: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '8px', marginTop: '1px', flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  )
};

export default function ChatView({ engines, activeEngine, onProviderChange, sessionId, currentTitle = '새 채팅', onTitleUpdate }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiConversation, setApiConversation] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSummarizing, setIsSummarizing] = useState(false);

  const [toasts, setToasts] = useState<SystemToast[]>([]);

  const [isDark, setIsDark] = useState(() => document.documentElement.getAttribute('data-theme') === 'dark');

  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const filteredCommands = SLASH_COMMANDS.filter(c =>
    c.command.includes(slashFilter.toLowerCase())
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

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
          const uiMessages: Message[] = history
            .filter((m: any) => m.role === 'user' || m.role === 'assistant')
            .map((m: any) => ({
              id: m.id,
              sender: m.role === 'user' ? 'user' : 'bot',
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

  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'smooth') => {
    if (feedRef.current) {
      feedRef.current.scrollTo({
        top: feedRef.current.scrollHeight,
        behavior
      });
    }
  };

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages, loading]);

  useEffect(() => {
    const handleClick = () => setShowSlashMenu(false);
    if (showSlashMenu) document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showSlashMenu]);

  // 💡 [사양 확장 개조] 이제 텍스트 외에도 구조화 데이터(pluginList)를 받아올 수 있도록 모듈 탑재
  const triggerSystemToast = (text: string, type: SystemToast['type'] = 'info', pluginList?: any[]) => {
    const toastId = generateId();
    setToasts(prev => [...prev, { id: toastId, type, text, pluginList }]);
    
    // 리포트 확인 효율을 위해 플러그인 리스트 뷰는 12초간 상공 대기 처리
    const timeoutDuration = type === 'plugins_report' ? 12000 : 8000;
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toastId));
    }, timeoutDuration);
  };

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
          text: `채팅 화면이 청소되었습니다. 새로운 대화를 시작하세요.`,
        }]);
        setApiConversation([]);
        triggerSystemToast('채팅 화면 및 대화 세션 컨텍스트가 초기화되었습니다.');
        break;

      case '/summary': {
        const summaryRow = await window.electronAPI.getSummary(sessionId).catch(() => null);
        if (summaryRow) {
          triggerSystemToast(`저장된 동적 대화 요약본 명세:\n\n${summaryRow.summary}`);
        } else if (apiConversation.length > 0) {
          setIsSummarizing(true);
          try {
            const res = await window.electronAPI.sendChat({
              engine: activeEngine,
              apiKey: activeEngine.apiKey,
              messages: [
                ...apiConversation,
                { role: 'user', content: '지금까지의 대화를 핵심 위주로 3문장 이내로 요약해줘. 요약문만 출력해.' },
              ],
            });
            const text = res.data?.text ?? '요약 실패';
            triggerSystemToast(`실시간 컴프레션 대화 요약 결과:\n\n${text}`);
          } finally {
            setIsSummarizing(false);
          }
        } else {
          triggerSystemToast('요약 파싱을 실행할 누적 대화 기록이 존재하지 않습니다.');
        }
        break;
      }

      case '/engine':
        triggerSystemToast(
          `현재 연동된 LLM 가동 명세\n` +
          `• 코어 엔진: ${activeEngine?.name}\n` +
          `• 프로바이더: ${activeEngine?.provider}\n` +
          `• 모델 식별자: ${activeEngine?.model}\n` +
          `• 활성 컨텍스트: ${apiConversation.filter(m => m.role === 'user' || m.role === 'assistant').length}개 레코드`
        );
        break;

      case '/plugins': {
        const pluginList = await window.electronAPI.getMcpPluginsList().catch(() => []);
        if (pluginList.length === 0) {
          triggerSystemToast('장착되어 가동 중인 외부 MCP 플러그인 생태계가 공백 상태입니다.');
        } else {
          // 💡 [대변혁] 문자열 정렬 조립을 중단하고 원천 데이터 배열을 토스트 서브 모듈로 직접 주입 우회
          triggerSystemToast('', 'plugins_report', pluginList);
        }
        break;
      }

      case '/help':
        triggerSystemToast(
          `MCP 터미널 제어 커맨드 구조 안내\n\n` +
          SLASH_COMMANDS.map(c => `${c.command}   —   ${c.description}`).join('\n')
        );
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

  const DynamicIcon = ({ type }: { type: SlashCommand['iconType'] }) => {
    const Component = SvgIcon[type];
    return <Component />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', backgroundColor: 'transparent', overflow: 'hidden', position: 'relative', boxSizing: 'border-box' }}>

      {/* 우측 상단 토스트 팝업 컨테이너 레이어 */}
      <div style={{ position: 'absolute', top: '24px', right: '24px', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 10001, width: '360px', pointerEvents: 'none' }}>
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 30, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 350, damping: 26 }}
              style={{
                pointerEvents: 'auto',
                background: 'var(--bg-bubble-bot)',
                backdropFilter: 'blur(30px)',
                WebkitBackdropFilter: 'blur(30px)',
                border: 'var(--border-glass)',
                borderRadius: '14px',
                padding: '14px 16px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
                color: 'var(--color-text-main)',
                fontSize: '0.85rem',
                fontWeight: 500,
                lineHeight: 1.5,
                display: 'flex',
                alignItems: 'flex-start'
              }}
            >
              <SvgIcon.info />
              <div style={{ flexGrow: 1, width: '100%' }}>
                
                {/* 💡 [분기 대응] 일반 텍스트 안내 모드인 경우 */}
                {toast.type === 'info' && (
                  <div style={{ whiteSpace: 'pre-wrap' }}>{toast.text}</div>
                )}

                {/* 💡 [핵심 패치 지점] /plugins 커맨드가 불렸을 때 표출될 CSS 렌더링 미니 대시보드 폼 구조 */}
                {toast.type === 'plugins_report' && toast.pluginList && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', borderBottom: '1px solid rgba(128,128,128,0.15)', paddingBottom: '6px', marginBottom: '4px', color: 'var(--color-text-main)' }}>
                      MCP Ecosystem Registry ({toast.pluginList.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                      {toast.pluginList.map((p: any, idx: number) => {
                        const isEnabled = p.enabled !== false;
                        return (
                          <div key={p.id || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(128,128,128,0.03)', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(128,128,128,0.08)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                              
                              {/* 🟢⚪ [PluginsView 테마 동기화] 이모지 제거 및 가변 인라인 라이트 닷 기공 */}
                              <span style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                backgroundColor: isEnabled ? '#10b981' : 'rgba(128,128,128,0.4)',
                                flexShrink: 0,
                                boxShadow: isEnabled ? '0 0 5px #10b981' : 'none',
                                transition: 'all 0.2s'
                              }} />
                              
                              <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.82rem', color: isEnabled ? 'var(--color-text-main)' : 'var(--color-text-muted)' }}>
                                {p.name}
                              </span>
                            </div>
                            
                            {/* 뱃지 우측 정렬 구조 서브 배치 */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: 800 }}>
                              <span style={{ padding: '1px 5px', borderRadius: '4px', background: p.type === 'remote' ? 'rgba(59,130,246,0.12)' : 'rgba(245,158,11,0.12)', color: p.type === 'remote' ? '#3b82f6' : '#f59e0b', textTransform: 'uppercase' }}>
                                {p.type}
                              </span>
                              <span style={{ color: 'var(--color-text-muted)' }}>
                                v{p.version || '1.0.0'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* 요약 진행 배너 */}
      <AnimatePresence>
        {isSummarizing && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            style={{ padding: '10px 20px', textAlign: 'center', background: 'rgba(128, 128, 128, 0.08)', borderBottom: '1px solid rgba(128,128,128,0.15)', fontSize: '0.8rem', color: 'var(--color-text-main)', fontWeight: 600, overflow: 'hidden' }}
          >
            ✦ 대화 내용을 요약하는 중입니다...
          </motion.div>
        )}
      </AnimatePresence>

      {/* 메시지 목록 피드 */}
      <div 
        ref={feedRef}
        style={{ flexGrow: 1, width: '100%', padding: '30px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      >
        {isLoadingHistory ? (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', marginTop: '40px', fontWeight: 500 }}>대화 기록 불러오는 중...</div>
        ) : (
          <div style={{ width: '100%', maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                const isUser = msg.sender === 'user';
                
                return (
                  <motion.div 
                    key={msg.id}
                    initial={{ opacity: 0, y: 20, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 450, damping: 32 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', alignItems: isUser ? 'flex-end' : 'flex-start' }}
                  >
                    {!isUser && (
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text-muted)', padding: '0 4px', marginBottom: '2px', letterSpacing: '0.02em' }}>
                        {activeEngine?.name}
                      </span>
                    )}
                    
                    <div style={{ 
                      padding: '13px 18px', 
                      borderRadius: isUser ? '18px 4px 18px 18px' : '4px 18px 18px 18px', 
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
                  </motion.div>
                );
              })}
            </AnimatePresence>
            
            <AnimatePresence>
              {loading && (
                <motion.div 
                  initial={{ opacity: 0, y: 15, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}
                >
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text-muted)', padding: '0 4px' }}>{activeEngine?.name}</span>
                  <div style={{ padding: '14px 22px', borderRadius: '16px', backgroundColor: 'var(--bg-glass-card)', border: 'var(--border-glass)', boxShadow: '0 4px 16px rgba(0,0,0,0.01)' }}>
                    <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', height: '10px' }}>
                      {[0, 1, 2].map(i => (
                        <motion.span 
                          key={i} 
                          animate={{ y: [0, -7, 0] }}
                          transition={{
                            duration: 1.1,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: i * 0.16
                          }}
                          style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--color-text-main)', display: 'inline-block' }} 
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} style={{ height: '2px' }} />
          </div>
        )}
      </div>

      {/* 입력 패널 영역 */}
      <div style={{ padding: '16px 20px 30px 20px', display: 'flex', justifyContent: 'center', position: 'relative' }}>
        <div style={{ width: '100%', maxWidth: '720px', position: 'relative' }}>

          {/* 슬래시 커맨드 팝업 메뉴 */}
          <AnimatePresence>
            {showSlashMenu && filteredCommands.length > 0 && (
              <motion.div
                onClick={e => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.96, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 10 }}
                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                style={{
                  position: 'absolute', bottom: 'calc(100% + 10px)', left: 0, right: 0,
                  background: 'var(--bg-bubble-bot)', 
                  border: 'var(--border-glass)', 
                  borderRadius: '16px', overflow: 'hidden',
                  backdropFilter: 'blur(30px)',
                  WebkitBackdropFilter: 'blur(30px)',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.15)',
                  zIndex: 100,
                  originY: 1
                }}
              >
                <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(128,128,128,0.1)', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 700, letterSpacing: '0.04em', backgroundColor: 'rgba(128,128,128,0.03)' }}>
                  커맨드 — ↑↓ 이동 · Enter 실행 · Tab 자동완성 · Esc 닫기
                </div>
                {filteredCommands.map((cmd, idx) => (
                  <motion.div
                    key={cmd.command}
                    onClick={() => executeSlashCommand(cmd.command)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 16px', cursor: 'pointer',
                      backgroundColor: idx === selectedIndex ? 'rgba(128,128,128,0.06)' : 'transparent',
                      borderLeft: idx === selectedIndex ? '4px solid var(--color-text-main)' : '4px solid transparent',
                      transition: 'background-color 0.12s ease, border-left 0.12s ease',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', color: idx === selectedIndex ? 'var(--color-text-main)' : 'var(--color-text-muted)', flexShrink: 0 }}>
                      <DynamicIcon type={cmd.iconType} />
                    </span>
                    <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-text-main)', fontFamily: 'monospace' }}>
                      {cmd.command}
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                      {cmd.description}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

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
            <motion.button
              onClick={handleSend} 
              disabled={loading || !input.trim()}
              whileHover={{ scale: (loading || !input.trim()) ? 1 : 1.06 }}
              whileTap={{ scale: (loading || !input.trim()) ? 1 : 0.95 }}
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
                transition: 'background-color 0.15s ease, color 0.15s ease',
              }}
            >↑</motion.button>
          </div>
        </div>
      </div>

    </div>
  );
}