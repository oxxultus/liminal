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

interface SystemToast {
  id: string;
  type: 'info' | 'plugins_report';
  text?: string;
  pluginList?: any[];
}

interface AttachedFile {
  id: string;
  name: string;
  type: string;
  base64Data?: string;
  codeContent?: string;
  path?: string;
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

interface DynamicIconProps {
  type: 'clear' | 'summary' | 'engine' | 'plugins' | 'help';
}

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
  ),
  plus: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  ),
  uploadCloud: () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-main)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px', opacity: 0.85 }}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
  fileIcon: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
    </svg>
  ),
  codeIcon: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
    </svg>
  ),
  pdfIcon: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
    </svg>
  ),
  copyIcon: () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  ),
  checkIcon: () => (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
};

const DynamicIcon = ({ type }: DynamicIconProps) => {
  switch (type) {
    case 'clear': return <SvgIcon.clear />;
    case 'summary': return <SvgIcon.summary />;
    case 'engine': return <SvgIcon.engine />;
    case 'plugins': return <SvgIcon.plugins />;
    case 'help': return <SvgIcon.help />;
    default: return null;
  }
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
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);

  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const filteredCommands = SLASH_COMMANDS.filter(c =>
    c.command.includes(slashFilter.toLowerCase())
  );

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

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
      feedRef.current.scrollTo({ top: feedRef.current.scrollHeight, behavior });
    }
  };

  useEffect(() => { scrollToBottom('smooth'); }, [messages, loading]);

  useEffect(() => {
    const handleClick = () => setShowSlashMenu(false);
    if (showSlashMenu) document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [showSlashMenu]);

  const triggerSystemToast = (text: string, type: SystemToast['type'] = 'info', pluginList?: any[]) => {
    const toastId = generateId();
    setToasts(prev => [...prev, { id: toastId, type, text, pluginList }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toastId));
    }, type === 'plugins_report' ? 12000 : 8000);
  };

  const handleClipButtonClick = () => { fileInputRef.current?.click(); };

  const saveMessage = async (role: 'user' | 'assistant' | 'system', content: string) => {
    const id = generateId();
    await window.electronAPI.saveMessage({ id, sessionId, role, content });
    return id;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    if (val === '/') {
      setShowSlashMenu(true); setSlashFilter(''); setSelectedIndex(0);
    } else if (val.startsWith('/') && !val.includes(' ')) {
      setShowSlashMenu(true); setSlashFilter(val); setSelectedIndex(0);
    } else {
      setShowSlashMenu(false);
    }
  };

  const processFileContent = (file: File) => {
    if (activeEngine.provider === 'openai' && (file.type === 'application/pdf' || file.name.endsWith('.pdf'))) {
      triggerSystemToast('OpenAI 엔진은 API 사양상 PDF 파일 분석을 지원하지 않습니다.');
      return;
    }
    const isTextCodeFile =
      file.type.startsWith('text/') ||
      /\.(java|cpp|h|mjs|js|ts|tsx|json|html|css|yaml|yml|sh|properties|xml)$/i.test(file.name);
    const fileReader = new FileReader();
    fileReader.onload = () => {
      const fileResult = fileReader.result as string;
      setAttachedFiles(prev => [...prev, {
        id: generateId(), name: file.name, type: file.type,
        base64Data: isTextCodeFile ? undefined : fileResult,
        codeContent: isTextCodeFile ? fileResult : undefined,
        path: (file as any).path
      }]);
    };
    if (isTextCodeFile) fileReader.readAsText(file, 'utf-8');
    else fileReader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) processFileContent(files[i]);
    e.target.value = '';
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragActive(true);
    else if (e.type === 'dragleave') {
      const rect = e.currentTarget.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX >= rect.right || e.clientY < rect.top || e.clientY >= rect.bottom) {
        setIsDragActive(false);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragActive(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) for (let i = 0; i < files.length; i++) processFileContent(files[i]);
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
        engine: activeEngine, apiKey: activeEngine.apiKey,
        messages: [...summaryTarget, { role: 'user', content: '위 대화 내용을 핵심 정보 위주로 5문장 이내로 요약해줘. 요약문만 출력하고 다른 말은 하지 마.' }],
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

  const executeSlashCommand = async (command: string) => {
    setInput(''); setShowSlashMenu(false);
    switch (command) {
      case '/clear':
        setMessages([{ id: generateId(), sender: 'bot', text: '채팅 화면이 청소되었습니다. 새로운 대화를 시작하세요.' }]);
        setApiConversation([]);
        break;
      case '/summary': {
        const summaryRow = await window.electronAPI.getSummary(sessionId).catch(() => null);
        if (summaryRow) {
          triggerSystemToast(`저장된 동적 대화 요약본 명세:\n\n${summaryRow.summary}`);
        } else if (apiConversation.length > 0) {
          setIsSummarizing(true);
          try {
            const res = await window.electronAPI.sendChat({
              engine: activeEngine, apiKey: activeEngine.apiKey,
              messages: [...apiConversation, { role: 'user', content: '지금까지의 대화를 핵심 위주로 3문장 이내로 요약해줘. 요약문만 출력해.' }],
            });
            triggerSystemToast(`실시간 컴프레션 대화 요약 결과:\n\n${res.data?.text ?? '요약 실패'}`);
          } finally { setIsSummarizing(false); }
        } else {
          triggerSystemToast('요약 파싱을 실행할 누적 대화 기록이 존재하지 않습니다.');
        }
        break;
      }
      case '/engine':
        triggerSystemToast(
          `현재 연동된 LLM 가동 명세\n• 코어 엔진: ${activeEngine?.name}\n• 프로바이더: ${activeEngine?.provider}\n• 모델 식별자: ${activeEngine?.model}\n• 활성 컨텍스트: ${apiConversation.filter(m => m.role === 'user' || m.role === 'assistant').length}개 레코드`
        );
        break;
      case '/plugins': {
        const pluginList = await window.electronAPI.getMcpPluginsList().catch(() => []);
        if (pluginList.length === 0) triggerSystemToast('장착되어 가동 중인 외부 MCP 플러그인 생태계가 공백 상태입니다.');
        else triggerSystemToast('', 'plugins_report', pluginList);
        break;
      }
      case '/help':
        triggerSystemToast(`MCP 터미널 제어 커맨드 구조 안내\n\n` + SLASH_COMMANDS.map(c => `${c.command}   —   ${c.description}`).join('\n'));
        break;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSlashMenu && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter') { e.preventDefault(); executeSlashCommand(filteredCommands[selectedIndex].command); return; }
      if (e.key === 'Escape') { setShowSlashMenu(false); return; }
      if (e.key === 'Tab') { e.preventDefault(); setInput(filteredCommands[selectedIndex].command); setShowSlashMenu(false); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleSend = async () => {
    if (!input.trim() && attachedFiles.length === 0) return;
    if (loading) return;
    const hasPdf = attachedFiles.some(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
    if (activeEngine.provider === 'openai' && hasPdf) {
      triggerSystemToast('PDF가 포함되어 있습니다. Claude 또는 Gemini 엔진으로 변경하세요.');
      return;
    }
    if (!activeEngine?.apiKey) { alert(`${activeEngine?.name}의 API Key가 설정되지 않았습니다.`); return; }

    setLoading(true);
    let userText = input.trim();
    const textFiles = attachedFiles.filter(f => f.codeContent);
    if (textFiles.length > 0) {
      userText += `\n\n### 📄 첨부된 파일 소스코드 내용 목록`;
      textFiles.forEach(f => {
        const ext = f.name.split('.').pop() || 'txt';
        userText += `\n\n* **파일명: ${f.name}**\n\`\`\`${ext}\n${f.codeContent}\n\`\`\``;
      });
    }
    const nonImageOrPdfFiles = attachedFiles.filter(f => f.path && !f.type.startsWith('image/') && !f.name.endsWith('.pdf'));
    if (nonImageOrPdfFiles.length > 0) {
      userText += `\n\n📁 [첨부 파일 실물 경로 목록]:\n` + nonImageOrPdfFiles.map(f => `• ${f.path}`).join('\n');
    }
    let embeddedMessageText = userText;
    const imageFiles = attachedFiles.filter(f => f.type.startsWith('image/') && f.base64Data);
    for (const img of imageFiles) {
      if (window.electronAPI.uploadLocalImage) {
        const uploadRes = await window.electronAPI.uploadLocalImage({ name: img.name, base64Data: img.base64Data! });
        if (uploadRes && uploadRes.success && uploadRes.localPath) {
          embeddedMessageText += `\n[IMG_PATH:${uploadRes.localPath}]`;
        }
      }
    }
    attachedFiles.forEach(f => {
      let fType = 'document';
      if (f.name.endsWith('.pdf')) fType = 'pdf';
      else if (f.codeContent) fType = 'code';
      embeddedMessageText += `\n[FILE_META:${f.name}|${fType}]`;
    });

    setMessages(prev => [...prev, { id: generateId(), sender: 'user', text: embeddedMessageText }]);
    setInput('');
    setAttachedFiles([]);

    try {
      await saveMessage('user', embeddedMessageText);
      const isFirstUserMessage = !apiConversation.some(m => m.role === 'user');
      if (isFirstUserMessage && currentTitle === '새 채팅') {
        const cleanTitle = input.trim().length > 28 ? input.trim().slice(0, 28) + '…' : (input.trim() || attachedFiles[0]?.name || '새 채팅');
        await window.electronAPI.updateChatSessionTitle?.({ sessionId, title: cleanTitle }).catch(() => {});
        onTitleUpdate(sessionId, cleanTitle);
      }
      let contentPayload: any[] = [{ type: 'text', text: userText || '첨부한 멀티모달 자원을 해석해줘.' }];
      imageFiles.forEach(img => contentPayload.push({ type: 'image_url', image_url: { url: img.base64Data } }));
      const pdfFiles = attachedFiles.filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
      pdfFiles.forEach(pdf => contentPayload.push({ type: 'pdf_file', base64Data: pdf.base64Data }));
      const finalPayload = (imageFiles.length > 0 || pdfFiles.length > 0) ? contentPayload : embeddedMessageText;
      let updatedHistory = [...apiConversation, { role: 'user', content: finalPayload }];
      if (apiConversation.length >= SUMMARY_TRIGGER) updatedHistory = await compressWithSummary(updatedHistory);
      const rawTools: any[] = await window.electronAPI.getMcpTools();
      const toolsByProvider: Record<string, any[]> = {
        anthropic: rawTools.map(t => ({ name: t.name, description: t.description, input_schema: t.input_schema })),
        openai: rawTools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.input_schema } })),
        google: rawTools.length > 0 ? [{ functionDeclarations: rawTools.map(t => ({ name: t.name, description: t.description, parameters: t.input_schema })) }] : [],
      };
      const tools = toolsByProvider[activeEngine.provider] ?? [];
      const proxyRes = await window.electronAPI.sendChat({
        engine: activeEngine, messages: updatedHistory, apiKey: activeEngine.apiKey,
        tools: tools.length > 0 ? tools : undefined,
      });
      if (!proxyRes.success) throw new Error(proxyRes.error);
      const botResponseText = proxyRes.data?.text || '';
      if (botResponseText) {
        setMessages(prev => [...prev, { id: generateId(), sender: 'bot', text: botResponseText }]);
        await saveMessage('assistant', botResponseText);
        if (activeEngine.provider === 'openai' && proxyRes.data.rawMessage) updatedHistory.push(proxyRes.data.rawMessage);
        else updatedHistory.push({ role: 'assistant', content: botResponseText });
      }
      setApiConversation(updatedHistory);
    } catch (error: any) {
      console.error('Renderer Chat Error:', error);
      setMessages(prev => [...prev, { id: generateId(), sender: 'bot', text: `❌ 에러: ${error.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const renderUserMessageWithPreviews = (rawText: string) => {
    // 💡 [개선] 경로 내의 모든 문자를 포용하도록 정규식 공백 처리 보정
    const imgPathRegex = /\[IMG_PATH:(media:\/\/[^\]]+)\]/g;
    const fileMetaRegex = /\[FILE_META:([^|]+)\|([^\]]+)\]/g;
    
    const imagePaths: string[] = [];
    const files: Array<{ name: string; type: string }> = [];
    
    let match;
    while ((match = imgPathRegex.exec(rawText)) !== null) { 
      imagePaths.push(match[1]); 
    }
    while ((match = fileMetaRegex.exec(rawText)) !== null) { 
      files.push({ name: decodeURIComponent(match[1]), type: match[2] }); 
    }

    const cleanedText = rawText.replace(imgPathRegex, '').replace(fileMetaRegex, '').trim();

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
        {files.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
            {files.map((file, idx) => (
              <div key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', background: 'rgba(128,128,128,0.08)', borderRadius: '8px', border: '1px solid rgba(128,128,128,0.12)', fontSize: '0.75rem', fontWeight: 700 }}>
                {file.type === 'pdf' ? <SvgIcon.pdfIcon /> : (file.type === 'code' ? <SvgIcon.codeIcon /> : <SvgIcon.fileIcon />)}
                <span style={{ color: 'var(--color-text-main)' }}>{file.name}</span>
                <span style={{ fontSize: '0.62rem', background: file.type === 'pdf' ? 'rgba(239,68,68,0.15)' : 'rgba(128,128,128,0.15)', color: file.type === 'pdf' ? '#ef4444' : 'var(--color-text-muted)', padding: '1px 4px', borderRadius: '3px', fontFamily: 'monospace' }}>
                  {file.name.split('.').pop()?.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
        {imagePaths.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '4px 0' }}>
            {imagePaths.map((src, idx) => (
              <img key={idx} src={src} 
                onError={(e) => console.error('이미지 로드 실패:', src, e)}
                style={{ width: '140px', height: '140px', borderRadius: '10px', objectFit: 'cover', border: '1px solid var(--border-glass)', boxShadow: '0 4px 14px rgba(0,0,0,0.06)' }}
              />
            ))}
          </div>
        )}
        {cleanedText ? <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{cleanedText}</div> : null}
      </div>
    );
  };

  // =========================================================
  // 💡 마크다운 렌더러 컴포넌트 정의
  // =========================================================
  const markdownComponents = {
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const codeString = String(children).replace(/\n$/, '');
      const codeId = `code-${codeString.slice(0, 20)}`;

      if (!inline && match) {
        return (
          <div style={{
            margin: '16px 0', borderRadius: '12px', overflow: 'hidden',
            border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
            boxShadow: isDark
              ? '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)'
              : '0 4px 24px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)',
          }}>
            {/* 언어 헤더 바 */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 14px',
              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
              borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {['#ff5f57', '#febc2e', '#28c840'].map((color, i) => (
                  <span key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: color, opacity: 0.8 }} />
                ))}
                <span style={{
                  fontSize: '0.72rem', fontWeight: 700, fontFamily: 'monospace',
                  color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.35)',
                  letterSpacing: '0.06em', textTransform: 'uppercase' as const, marginLeft: '4px',
                }}>
                  {match[1]}
                </span>
              </div>
              <motion.button
                onClick={() => handleCopyCode(codeString, codeId)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  background: copiedCode === codeId
                    ? (isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)')
                    : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
                  border: copiedCode === codeId
                    ? '1px solid rgba(16,185,129,0.3)'
                    : (isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)'),
                  borderRadius: '6px', padding: '4px 10px', cursor: 'pointer',
                  fontSize: '0.72rem', fontWeight: 700,
                  color: copiedCode === codeId ? '#10b981' : (isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)'),
                  transition: 'all 0.2s ease', letterSpacing: '0.02em',
                }}
              >
                {copiedCode === codeId ? <><SvgIcon.checkIcon />복사됨</> : <><SvgIcon.copyIcon />복사</>}
              </motion.button>
            </div>
            {/* 코드 본문 */}
            <div style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
              <SyntaxHighlighter
                style={(isDark ? vscDarkPlus : prism) as any}
                language={match[1]}
                PreTag="div"
                customStyle={{
                  margin: 0, padding: '16px 18px',
                  background: isDark ? '#1a1b26' : '#fafafa',
                  borderRadius: 0,
                }}
                {...props}
              >
                {codeString}
              </SyntaxHighlighter>
            </div>
          </div>
        );
      }

      return (
        <code style={{
          background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
          border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
          padding: '2px 6px', borderRadius: '5px',
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          fontSize: '0.875em', fontWeight: 600,
          color: isDark ? '#e2b96f' : '#c2410c',
          letterSpacing: '-0.01em',
        }} {...props}>
          {children}
        </code>
      );
    },

    h1: ({ children }: any) => (
      <h1 style={{
        fontSize: '1.5rem', fontWeight: 800, margin: '24px 0 12px',
        color: 'var(--color-text-main)', letterSpacing: '-0.03em', lineHeight: 1.3,
        paddingBottom: '10px',
        borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
      }}>{children}</h1>
    ),
    h2: ({ children }: any) => (
      <h2 style={{
        fontSize: '1.2rem', fontWeight: 750, margin: '20px 0 10px',
        color: 'var(--color-text-main)', letterSpacing: '-0.02em', lineHeight: 1.4,
        paddingBottom: '6px',
        borderBottom: isDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)',
      }}>{children}</h2>
    ),
    h3: ({ children }: any) => (
      <h3 style={{
        fontSize: '1.05rem', fontWeight: 700, margin: '16px 0 8px',
        color: 'var(--color-text-main)', letterSpacing: '-0.01em', lineHeight: 1.4,
      }}>{children}</h3>
    ),
    h4: ({ children }: any) => (
      <h4 style={{
        fontSize: '0.95rem', fontWeight: 700, margin: '12px 0 6px',
        color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
        textTransform: 'uppercase' as const, letterSpacing: '0.05em', lineHeight: 1.4,
      }}>{children}</h4>
    ),

    blockquote: ({ children }: any) => (
      <blockquote style={{
        margin: '14px 0', padding: '12px 18px',
        borderLeft: `3px solid #6366f1`,
        background: isDark ? 'rgba(99,102,241,0.07)' : 'rgba(99,102,241,0.05)',
        borderRadius: '0 10px 10px 0',
        color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)',
        fontStyle: 'italic' as const, fontWeight: 500, fontSize: '0.95rem', lineHeight: 1.7,
      }}>
        {children}
      </blockquote>
    ),

    ul: ({ children }: any) => (
      <ul style={{ paddingLeft: '8px', margin: '8px 0', listStyle: 'none', display: 'flex', flexDirection: 'column' as const, gap: '4px' }}>
        {children}
      </ul>
    ),
    ol: ({ children }: any) => (
      <ol style={{ paddingLeft: '20px', margin: '8px 0', display: 'flex', flexDirection: 'column' as const, gap: '4px' }}>
        {children}
      </ol>
    ),
    li: ({ children }: any) => (
      <li style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.95rem', lineHeight: 1.65, fontWeight: 500, color: 'var(--color-text-main)' }}>
        <span style={{
          marginTop: '8px', width: '5px', height: '5px', borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          boxShadow: '0 0 6px rgba(99,102,241,0.4)',
        }} />
        <span>{children}</span>
      </li>
    ),

    table: ({ children }: any) => (
      <div style={{
        margin: '14px 0', overflowX: 'auto', borderRadius: '12px',
        border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
        boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.06)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontSize: '0.88rem' }}>
          {children}
        </table>
      </div>
    ),
    thead: ({ children }: any) => (
      <thead style={{
        background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
        borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
      }}>
        {children}
      </thead>
    ),
    tbody: ({ children }: any) => <tbody>{children}</tbody>,
    tr: ({ children }: any) => (
      <tr style={{ borderBottom: isDark ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(0,0,0,0.04)', transition: 'background 0.15s' }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
      >
        {children}
      </tr>
    ),
    th: ({ children }: any) => (
      <th style={{
        padding: '10px 16px', textAlign: 'left' as const, fontWeight: 800,
        fontSize: '0.78rem', letterSpacing: '0.06em', textTransform: 'uppercase' as const,
        color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)',
      }}>{children}</th>
    ),
    td: ({ children }: any) => (
      <td style={{ padding: '10px 16px', fontWeight: 500, lineHeight: 1.6, color: 'var(--color-text-main)' }}>
        {children}
      </td>
    ),

    a: ({ href, children }: any) => (
      <a href={href} target="_blank" rel="noopener noreferrer" style={{
        color: '#6366f1', fontWeight: 600, textDecoration: 'none',
        borderBottom: '1px solid rgba(99,102,241,0.3)', transition: 'border-color 0.15s, color 0.15s',
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#818cf8'; (e.currentTarget as HTMLElement).style.borderBottomColor = '#818cf8'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#6366f1'; (e.currentTarget as HTMLElement).style.borderBottomColor = 'rgba(99,102,241,0.3)'; }}
      >
        {children}
      </a>
    ),
    hr: () => (
      <hr style={{
        border: 'none', margin: '20px 0', height: '1px',
        background: isDark
          ? 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)'
          : 'linear-gradient(90deg, transparent, rgba(0,0,0,0.1), transparent)',
      }} />
    ),
    p: ({ children }: any) => (
      <p style={{ margin: '4px 0 10px', lineHeight: 1.75, wordBreak: 'break-word' as const, fontSize: '0.95rem', fontWeight: 500, color: 'var(--color-text-main)' }}>
        {children}
      </p>
    ),
    strong: ({ children }: any) => (
      <strong style={{ fontWeight: 800, color: 'var(--color-text-main)' }}>{children}</strong>
    ),
    em: ({ children }: any) => (
      <em style={{ fontStyle: 'italic' as const, color: isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.65)' }}>{children}</em>
    ),
  };

  return (
    <div
      onDragEnter={handleDrag} onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}
      style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', backgroundColor: 'transparent', overflow: 'hidden', position: 'relative', boxSizing: 'border-box' }}
    >
      {/* 드래그 오버레이 */}
      <AnimatePresence>
        {isDragActive && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.55)',
              backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 50000, pointerEvents: 'none'
            }}
          >
            <motion.div
              initial={{ scale: 0.94, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              style={{
                width: '460px', padding: '40px 24px', borderRadius: '24px',
                border: '2px dashed var(--color-text-main)',
                backgroundColor: 'var(--bg-glass-card)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 20px 50px rgba(0,0,0,0.1)'
              }}
            >
              <SvgIcon.uploadCloud />
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text-main)', letterSpacing: '-0.01em', textAlign: 'center' }}>
                여기에 파일들을 드롭하여 대화에 추가하세요
              </span>
              <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-text-muted)', marginTop: '6px', textAlign: 'center' }}>
                이미지 판독·PDF 고속 처리 및 소스코드 로컬 디스크 파싱 결합 가동
              </span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 토스트 컨테이너 */}
      <div style={{ position: 'absolute', top: '24px', right: '24px', display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 10001, width: '360px', pointerEvents: 'none' }}>
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 30, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 20, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 350, damping: 26 }}
              style={{
                pointerEvents: 'auto', background: 'var(--bg-bubble-bot)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
                border: 'var(--border-glass)', borderRadius: '14px', padding: '14px 16px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.15)', color: 'var(--color-text-main)',
                fontSize: '0.85rem', fontWeight: 500, lineHeight: 1.5, display: 'flex', alignItems: 'flex-start'
              }}
            >
              <SvgIcon.info />
              <div style={{ flexGrow: 1, width: '100%' }}>
                {toast.type === 'info' && <div style={{ whiteSpace: 'pre-wrap' }}>{toast.text}</div>}
                {toast.type === 'plugins_report' && toast.pluginList && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.88rem', borderBottom: '1px solid rgba(128,128,128,0.15)', paddingBottom: '6px', marginBottom: '4px' }}>
                      MCP Ecosystem Registry ({toast.pluginList.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                      {toast.pluginList.map((p: any, idx: number) => {
                        const isEnabled = p.enabled !== false;
                        return (
                          <div key={p.id || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(128,128,128,0.03)', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(128,128,128,0.08)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isEnabled ? '#10b981' : 'rgba(128,128,128,0.4)', flexShrink: 0, boxShadow: isEnabled ? '0 0 5px #10b981' : 'none' }} />
                              <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.82rem', color: isEnabled ? 'var(--color-text-main)' : 'var(--color-text-muted)' }}>{p.name}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, fontSize: '0.68rem', fontFamily: 'monospace', fontWeight: 800 }}>
                              <span style={{ padding: '1px 5px', borderRadius: '4px', background: p.type === 'remote' ? 'rgba(59,130,246,0.12)' : 'rgba(245,158,11,0.12)', color: p.type === 'remote' ? '#3b82f6' : '#f59e0b', textTransform: 'uppercase' }}>{p.type}</span>
                              <span style={{ color: 'var(--color-text-muted)' }}>v{p.version || '1.0.0'}</span>
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

      {/* 메시지 피드 */}
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
                    initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
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
                      backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                      border: 'var(--border-glass)', color: 'var(--color-text-main)',
                      fontWeight: 500, maxWidth: '85%', lineHeight: 1.6, fontSize: '0.95rem',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.02)',
                    }}>
                      {isUser ? renderUserMessageWithPreviews(msg.text) : (
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                          {msg.text}
                        </ReactMarkdown>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {/* 로딩 인디케이터 */}
            <AnimatePresence>
              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 15, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}
                >
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text-muted)', padding: '0 4px' }}>{activeEngine?.name}</span>
                  <div style={{ padding: '14px 22px', borderRadius: '16px', backgroundColor: 'var(--bg-glass-card)', border: 'var(--border-glass)', boxShadow: '0 4px 16px rgba(0,0,0,0.01)' }}>
                    <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', height: '10px' }}>
                      {[0, 1, 2].map(i => (
                        <motion.span
                          key={i} animate={{ y: [0, -7, 0] }}
                          transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut', delay: i * 0.16 }}
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

      {/* 입력 패널 */}
      <div style={{ padding: '16px 20px 30px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
        <div style={{ width: '100%', maxWidth: '720px', position: 'relative' }}>

          {/* 파일 프리뷰 바 */}
          <div style={{
            position: 'absolute', bottom: 'calc(100% + 8px)', left: '12px', right: '12px',
            display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px',
            pointerEvents: 'auto', zIndex: 99
          }}>
            <AnimatePresence>
              {attachedFiles.map((file) => {
                const isTextCode = !file.base64Data && file.codeContent;
                return (
                  <motion.div
                    key={file.id}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '10px',
                      background: 'var(--bg-glass-card)', border: '1px solid var(--border-glass-input)',
                      backdropFilter: 'blur(20px)', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                    }}
                  >
                    {file.type.startsWith('image/') && file.base64Data ? (
                      <img src={file.base64Data} style={{ width: '18px', height: '18px', borderRadius: '3px', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', color: 'var(--color-text-muted)' }}>
                        {file.name.endsWith('.pdf') ? <SvgIcon.pdfIcon /> : (isTextCode ? <SvgIcon.codeIcon /> : <SvgIcon.fileIcon />)}
                      </span>
                    )}
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-main)', maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.name}
                    </span>
                    <button
                      onClick={() => setAttachedFiles(prev => prev.filter(f => f.id !== file.id))}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '1px', marginLeft: '2px', fontSize: '0.65rem', fontWeight: 900 }}
                    >✕</button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* 슬래시 커맨드 메뉴 */}
          <AnimatePresence>
            {showSlashMenu && filteredCommands.length > 0 && (
              <motion.div
                onClick={e => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.96, y: 15 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }}
                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                style={{
                  position: 'absolute', bottom: 'calc(100% + 10px)', left: 0, right: 0,
                  background: 'var(--bg-bubble-bot)', border: 'var(--border-glass)',
                  borderRadius: '16px', overflow: 'hidden', backdropFilter: 'blur(30px)',
                  WebkitBackdropFilter: 'blur(30px)', boxShadow: '0 12px 32px rgba(0,0,0,0.15)', zIndex: 100, originY: 1
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
                      display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', cursor: 'pointer',
                      backgroundColor: idx === selectedIndex ? 'rgba(128,128,128,0.06)' : 'transparent',
                      borderLeft: idx === selectedIndex ? '4px solid var(--color-text-main)' : '4px solid transparent',
                      transition: 'background-color 0.12s ease, border-left 0.12s ease',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', color: idx === selectedIndex ? 'var(--color-text-main)' : 'var(--color-text-muted)', flexShrink: 0 }}>
                      <DynamicIcon type={cmd.iconType} />
                    </span>
                    <span style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--color-text-main)', fontFamily: 'monospace' }}>{cmd.command}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>{cmd.description}</span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* 메인 인풋 박스 */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            backgroundColor: 'var(--bg-input)', borderRadius: '24px', padding: '6px 8px 6px 12px',
            backdropFilter: 'blur(30px)', WebkitAppRegion: 'no-drag',
            border: showSlashMenu ? '1px solid var(--color-text-main)' : 'var(--border-glass)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.04)', transition: 'border-color 0.2s, box-shadow 0.2s'
          }}>
            <input ref={fileInputRef} type="file" onChange={handleFileChange} style={{ display: 'none' }} multiple accept="image/*, .js, .mjs, .json, .txt, .pdf, .jar, .java, .cpp" />
            <motion.button
              type="button" onClick={handleClipButtonClick} disabled={loading}
              whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
              style={{ background: 'transparent', border: 'none', padding: '6px', color: 'var(--color-text-muted)', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <SvgIcon.plus />
            </motion.button>
            <input
              ref={inputRef} type="text" value={input}
              onChange={handleInputChange} onKeyDown={handleKeyDown}
              placeholder={loading ? '응답 대기 중...' : `${activeEngine?.name ?? 'AI'}에게 명령 · /로 커맨드`}
              disabled={loading}
              style={{ flexGrow: 1, padding: '8px 0', border: 'none', background: 'transparent', color: 'var(--color-text-main)', fontWeight: 500, outline: 'none', fontSize: '0.95rem' }}
            />
            <select value={activeEngine?.id ?? ''} onChange={(e) => onProviderChange(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--color-text-main)', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem', outline: 'none', paddingRight: '4px' }}
            >
              {engines.map(eng => <option key={eng.id} value={eng.id} style={{ background: 'var(--bg-input)', color: 'var(--color-text-main)' }}>{eng.name}</option>)}
            </select>
            <motion.button
              onClick={handleSend}
              disabled={loading || (!input.trim() && attachedFiles.length === 0)}
              whileHover={{ scale: (loading || (!input.trim() && attachedFiles.length === 0)) ? 1 : 1.06 }}
              whileTap={{ scale: (loading || (!input.trim() && attachedFiles.length === 0)) ? 1 : 0.95 }}
              style={{
                width: '36px', height: '36px', borderRadius: '50%', border: 'none',
                cursor: loading || (!input.trim() && attachedFiles.length === 0) ? 'not-allowed' : 'pointer',
                padding: '0',
                background: loading || (!input.trim() && attachedFiles.length === 0) ? 'rgba(128,128,128,0.1)' : 'var(--color-text-main)',
                color: loading || (!input.trim() && attachedFiles.length === 0) ? 'var(--color-text-muted)' : 'var(--bg-input)',
                fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background-color 0.15s ease, color 0.15s ease',
              }}
            >↑</motion.button>
          </div>
        </div>
      </div>
    </div>
  );
}