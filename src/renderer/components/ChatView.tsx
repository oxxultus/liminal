// src/renderer/components/ChatView.tsx
import React, { useState, useEffect, useRef } from 'react';
import { EngineConfig } from '../App';

interface ChatViewProps {
  engines: EngineConfig[];
  activeEngine: EngineConfig;
  onProviderChange: (id: string) => void;
  sessionId: string;
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

export default function ChatView({ engines, activeEngine, onProviderChange, sessionId, onTitleUpdate }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiConversation, setApiConversation] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // 슬래시 커맨드 관련 state
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 필터링된 커맨드 목록
  const filteredCommands = SLASH_COMMANDS.filter(c =>
    c.command.includes(slashFilter.toLowerCase())
  );

  // ── 세션 변경 시 히스토리 + 요약본 로드 ──
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

  // 슬래시 메뉴 외부 클릭 시 닫기
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

  // ── 슬래시 커맨드 실행 ──
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
          // 요약본 없으면 즉석 요약
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

  // ── 입력 변경 핸들러 ──
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

  // ── 키보드 핸들러 ──
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

  // ── 요약 압축 ──
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

  // ── 메시지 전송 ──
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

    setMessages(prev => [...prev, { id: generateId(), sender: 'user', text: userText }]);
    setInput('');
    setLoading(true);

    await saveMessage('user', userText);
    if (isFirstUserMessage) await updateSessionTitle(userText);

    let updatedHistory = [...apiConversation, { role: 'user', content: userText }];
    if (apiConversation.length >= SUMMARY_TRIGGER) {
      updatedHistory = await compressWithSummary(updatedHistory);
    }

    try {
      const rawTools: any[] = await window.electronAPI.getMcpTools();
      const toolsByProvider: Record<string, any[]> = {
        anthropic: rawTools.map(t => ({ name: t.name, description: t.description, input_schema: t.input_schema })),
        openai: rawTools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } })),
        google: rawTools.length > 0 ? [{ functionDeclarations: rawTools.map(t => ({ name: t.name, description: t.description, parameters: t.input_schema })) }] : [],
      };
      const tools = toolsByProvider[activeEngine.provider] ?? [];

      const proxyRes = await window.electronAPI.sendChat({
        engine: activeEngine, messages: updatedHistory,
        apiKey: activeEngine.apiKey,
        tools: tools.length > 0 ? tools : undefined,
      });
      if (!proxyRes.success) throw new Error(proxyRes.error);

      const data = proxyRes.data;
      let botResponseText = '';
      let requestedTools: Array<{ id: string; name: string; args: Record<string, any> }> = [];

      if (activeEngine.provider === 'anthropic' && data.rawContent) {
        for (const block of data.rawContent) {
          if (block.type === 'text') botResponseText += block.text;
          if (block.type === 'tool_use') requestedTools.push({ id: block.id, name: block.name, args: block.input });
        }
        updatedHistory.push({ role: 'assistant', content: data.rawContent });
      } else if (activeEngine.provider === 'openai' && data.rawMessage) {
        botResponseText = data.rawMessage.content || '';
        updatedHistory.push(data.rawMessage);
        if (data.rawMessage.tool_calls) {
          requestedTools = data.rawMessage.tool_calls.map((tc: any) => ({
            id: tc.id, name: tc.function.name, args: JSON.parse(tc.function.arguments),
          }));
        }
      } else {
        botResponseText = data.text || '';
        updatedHistory.push({ role: 'assistant', content: botResponseText });
      }

      if (requestedTools.length === 0) {
        if (botResponseText) {
          setMessages(prev => [...prev, { id: generateId(), sender: 'bot', text: botResponseText }]);
          await saveMessage('assistant', botResponseText);
        }
        setApiConversation(updatedHistory);
        return;
      }

      const claudeResultBlocks: any[] = [];
      for (const tool of requestedTools) {
        setMessages(prev => [...prev, { id: generateId(), sender: 'system', text: `⚙️ [MCP SYSTEM] 실행 중 -> ${tool.name}` }]);
        const execRes = await window.electronAPI.executeMcpTool(tool.name, tool.args);
        const resultText = execRes.success
          ? execRes.result?.content?.map((c: any) => c.text).join('\n') ?? JSON.stringify(execRes.result)
          : `❌ 실패: ${execRes.error}`;
        if (!execRes.success) setMessages(prev => [...prev, { id: generateId(), sender: 'bot', text: resultText }]);
        if (activeEngine.provider === 'openai') {
          updatedHistory.push({ role: 'tool', tool_call_id: tool.id, content: resultText });
        } else if (activeEngine.provider === 'anthropic') {
          claudeResultBlocks.push({ type: 'tool_result', tool_use_id: tool.id, content: resultText, is_error: !execRes.success });
        }
      }
      if (activeEngine.provider === 'anthropic' && claudeResultBlocks.length > 0) {
        updatedHistory.push({ role: 'user', content: claudeResultBlocks });
      }

      const finalRes = await window.electronAPI.sendChat({
        engine: activeEngine, messages: updatedHistory, apiKey: activeEngine.apiKey,
      });
      if (!finalRes.success) throw new Error(finalRes.error);
      const finalText = finalRes.data.text || '';
      if (finalText) {
        setMessages(prev => [...prev, { id: generateId(), sender: 'bot', text: finalText }]);
        await saveMessage('assistant', finalText);
        updatedHistory.push({ role: 'assistant', content: finalText });
      }
      setApiConversation(updatedHistory);

    } catch (error: any) {
      setMessages(prev => [...prev, { id: generateId(), sender: 'bot', text: `❌ 에러: ${error.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', backgroundColor: 'transparent', overflow: 'hidden', boxSizing: 'border-box' }}>

      {/* 요약 진행 배너 */}
      {isSummarizing && (
        <div style={{ padding: '8px 20px', textAlign: 'center', background: 'linear-gradient(90deg, rgba(6,182,212,0.15), rgba(30,58,138,0.2))', borderBottom: '1px solid rgba(6,182,212,0.2)', fontSize: '0.8rem', color: 'rgba(207,250,254,0.7)' }}>
          ✦ 대화 내용을 요약하는 중입니다...
        </div>
      )}

      {/* 메시지 목록 */}
      <div style={{ flexGrow: 1, width: '100%', padding: '30px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px' }}>
        {isLoadingHistory ? (
          <div style={{ color: 'rgba(207,250,254,0.4)', fontSize: '0.9rem', marginTop: '40px' }}>대화 기록 불러오는 중...</div>
        ) : (
          <div style={{ width: '100%', maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              if (msg.sender === 'system') return (
                <div key={msg.id} style={{ alignSelf: 'center', fontSize: '0.8rem', color: '#67e8f9', padding: '10px 16px', borderRadius: '12px', border: '1px solid rgba(103,232,249,0.15)', background: 'rgba(6,182,212,0.08)', whiteSpace: 'pre-wrap', maxWidth: '90%', lineHeight: 1.6 }}>
                  {msg.text}
                </div>
              );
              return (
                <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: isUser ? '#a29bfe' : '#fdcb6e', padding: '0 4px' }}>
                    {isUser ? 'Oxxultus' : activeEngine?.name}
                  </span>
                  <div style={{ padding: '12px 18px', borderRadius: '16px', backgroundColor: isUser ? 'rgba(162,155,254,0.15)' : 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', maxWidth: '85%', lineHeight: 1.6, fontSize: '0.9rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {msg.text}
                  </div>
                </div>
              );
            })}
            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fdcb6e', padding: '0 4px' }}>{activeEngine?.name}</span>
                <div style={{ padding: '12px 18px', borderRadius: '16px', backgroundColor: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <span style={{ display: 'inline-flex', gap: '4px' }}>
                    {[0, 1, 2].map(i => (
                      <span key={i} style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'rgba(207,250,254,0.5)', display: 'inline-block', animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                    ))}
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 입력창 + 슬래시 메뉴 */}
      <div style={{ padding: '16px 20px 30px 20px', display: 'flex', justifyContent: 'center', position: 'relative' }}>
        <div style={{ width: '100%', maxWidth: '720px', position: 'relative' }}>

          {/* 슬래시 커맨드 팝업 */}
          {showSlashMenu && filteredCommands.length > 0 && (
            <div
              onClick={e => e.stopPropagation()}
              style={{
                position: 'absolute', bottom: 'calc(100% + 8px)', left: 0, right: 0,
                backgroundColor: 'rgba(10, 20, 55, 0.96)',
                border: '1px solid rgba(6,182,212,0.25)',
                borderRadius: '14px', overflow: 'hidden',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                zIndex: 100,
              }}
            >
              {/* 팝업 헤더 */}
              <div style={{ padding: '8px 14px', borderBottom: '1px solid rgba(207,250,254,0.06)', fontSize: '0.7rem', color: 'rgba(207,250,254,0.35)', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                커맨드 — ↑↓ 이동 · Enter 실행 · Tab 자동완성 · Esc 닫기
              </div>
              {filteredCommands.map((cmd, idx) => (
                <div
                  key={cmd.command}
                  onClick={() => executeSlashCommand(cmd.command)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 14px', cursor: 'pointer',
                    backgroundColor: idx === selectedIndex ? 'rgba(6,182,212,0.12)' : 'transparent',
                    borderLeft: idx === selectedIndex ? '2px solid rgba(6,182,212,0.6)' : '2px solid transparent',
                    transition: 'all 0.1s ease',
                  }}
                >
                  <span style={{ fontSize: '1rem', flexShrink: 0 }}>{cmd.icon}</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: idx === selectedIndex ? '#cffafe' : 'rgba(207,250,254,0.8)', fontFamily: 'monospace' }}>
                    {cmd.command}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'rgba(207,250,254,0.4)', marginLeft: 'auto' }}>
                    {cmd.description}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 입력창 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: '24px', padding: '8px 16px', backdropFilter: 'blur(10px)', border: showSlashMenu ? '1px solid rgba(6,182,212,0.3)' : '1px solid rgba(207,250,254,0.1)', transition: 'border-color 0.15s' }}>
            <input
              ref={inputRef}
              type="text" value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={loading ? (isSummarizing ? '대화 요약 중...' : '응답 대기 중...') : `${activeEngine?.name ?? 'AI'}에게 명령 · /로 커맨드`}
              disabled={loading}
              style={{ flexGrow: 1, padding: '8px', border: 'none', background: 'transparent', color: '#fff', outline: 'none', fontSize: '0.9rem' }}
            />
            <select value={activeEngine?.id ?? ''} onChange={(e) => onProviderChange(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'rgba(207,250,254,0.6)', cursor: 'pointer', fontSize: '0.8rem', outline: 'none' }}>
              {engines.map(eng => <option key={eng.id} value={eng.id} style={{ backgroundColor: '#0d1b3e' }}>{eng.name}</option>)}
            </select>
            <button
              onClick={handleSend} disabled={loading || !input.trim()}
              style={{ width: '34px', height: '34px', borderRadius: '50%', border: 'none', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer', padding: '0', background: loading || !input.trim() ? 'rgba(207,250,254,0.1)' : 'linear-gradient(135deg, #06b6d4, #1e3a8a)', color: '#cffafe', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}
            >↑</button>
          </div>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1.1); } }`}</style>
    </div>
  );
}