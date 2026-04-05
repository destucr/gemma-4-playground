'use client';

import { useChat } from '@ai-sdk/react';
import { useRef, useEffect, useState, useCallback } from 'react';
import { ChatMessage } from './ChatMessage';
import { Header } from '@/components/Header';
import { InteractionBar } from '@/components/InteractionBar';
import { SkeletonMessage } from '@/components/SkeletonMessage';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Plus, Trash2, ChevronLeft, ChevronRight, Layout, Sparkles } from 'lucide-react';
import { validateModel } from '@/lib/utils';
import { getOrCreateKey, encrypt, decrypt } from '@/lib/encryption';
import { Message } from 'ai';
import { supabase } from '@/lib/supabase';

// ─── Constants & Types ──────────────────────────────────────────────────────
const STARTER_MISSIONS = [
  { label: "🏗️ System Design", prompt: "Design a high-performance distributed caching layer for a social media platform." },
  { label: "⚡ Code Optimization", prompt: "Explain how to optimize a Go service for low-latency message processing." },
  { label: "🛡️ Security Audit", prompt: "What are the core security principles for designing a zero-trust architecture?" },
];

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

export default function Chat() {
  const [userCountry, setUserCountry] = useState<string | null>(null);
  const [pendingQueue, setPendingQueue] = useState<{ content: string; files?: File[] }[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const [persistedError, setPersistedError] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('auto');
  
  // ── Multi-Session & Encryption State ──────────────────────────────────────
  const [sessions, setSessions] = useState<Record<string, ChatSession>>({});
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    reload,
    setMessages,
    setInput,
    append
  } = useChat({
    id: currentSessionId || undefined, 
    initialMessages: [],
    body: {
      model: selectedModel === 'auto' ? 'gemma4:26b' : selectedModel,
      userCountry,
    },
    onError: () => setPersistedError(true),
    onResponse: () => setPersistedError(false),
    onFinish: async (message) => {
      if (!currentSessionId || !encryptionKey) return;
      
      const encryptedContent = await encrypt(message.content, encryptionKey);
      await supabase.from('messages').insert({
        session_id: currentSessionId,
        role: message.role,
        content: encryptedContent,
        experimental_attachments: message.experimental_attachments
      });

      const currentSession = sessions[currentSessionId];
      if (currentSession && (currentSession.title === 'New Chat' || !currentSession.title)) {
        // Trigger Background Title Generation
        const response = await fetch('/api/chat', {
          method: 'POST',
          body: JSON.stringify({
            messages: [...messages, message].slice(-2),
            model: selectedModel === 'auto' ? 'gemma4:e4b' : selectedModel,
            isTitleGen: true
          })
        });

        if (response.ok) {
          const reader = response.body?.getReader();
          const decoder = new TextDecoder();
          let newTitle = '';
          while (true) {
            const { done, value } = await reader!.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('0:')) {
                try {
                  newTitle += JSON.parse(line.slice(2));
                } catch (e) { console.error(e); }
              }
            }
          }

          if (newTitle) {
            const cleanTitle = newTitle.trim().replace(/^["']|["']$/g, '');
            const encryptedTitle = await encrypt(cleanTitle, encryptionKey);
            await supabase.from('sessions').update({ title: encryptedTitle }).eq('id', currentSessionId);
            setSessions(prev => ({
              ...prev,
              [currentSessionId]: { ...currentSession, title: cleanTitle }
            }));
          }
        }
      }
    }
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Action Callbacks ──────────────────────────────────────────────────
  
  const switchSession = useCallback(async (id: string, currentSessions: Record<string, ChatSession>, key: CryptoKey) => {
    const session = currentSessions[id];
    if (!session) return;

    setCurrentSessionId(id);
    localStorage.setItem('last-session-id', id);

    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('session_id', id)
      .order('created_at', { ascending: true });

    const formattedMsgs: Message[] = await Promise.all((msgs || []).map(async m => ({
      id: m.id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      role: m.role as any,
      content: await decrypt(m.content, key),
      experimental_attachments: m.experimental_attachments,
      createdAt: new Date(m.created_at)
    })));

    setMessages(formattedMsgs);
  }, [setMessages]);

  const createNewSession = useCallback(async (key: CryptoKey) => {
    const id = crypto.randomUUID();
    const encryptedTitle = await encrypt('New Chat', key);
    
    await supabase.from('sessions').insert({
      id,
      title: encryptedTitle,
      model_pref: selectedModel
    });

    setSessions(prev => ({
      ...prev,
      [id]: { id, title: 'New Chat', messages: [], createdAt: Date.now() }
    }));
    setCurrentSessionId(id);
    localStorage.setItem('last-session-id', id);
    setMessages([]);
    setInput('');
  }, [selectedModel, setMessages, setInput]);

  const deleteSession = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('sessions').delete().eq('id', id);

    setSessions(prev => {
      const newSessions = { ...prev };
      delete newSessions[id];
      
      const remainingIds = Object.keys(newSessions);
      if (remainingIds.length === 0) {
        if (encryptionKey) createNewSession(encryptionKey);
        return prev;
      } else if (id === currentSessionId) {
        if (encryptionKey) switchSession(remainingIds[0], newSessions, encryptionKey);
      }
      return newSessions;
    });
  }, [currentSessionId, encryptionKey, createNewSession, switchSession]);

  // ── Persistence: Load from Supabase ──────────────────────────────────────
  useEffect(() => {
    async function init() {
      const key = await getOrCreateKey();
      setTimeout(() => setEncryptionKey(key), 0);

      const { data: savedSessions } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (savedSessions && savedSessions.length > 0) {
        const sessionMap: Record<string, ChatSession> = {};
        for (const s of savedSessions) {
          sessionMap[s.id] = {
            id: s.id,
            title: await decrypt(s.title, key),
            messages: [],
            createdAt: new Date(s.created_at).getTime()
          };
        }
        setTimeout(() => {
          setSessions(sessionMap);
          const lastId = localStorage.getItem('last-session-id') || savedSessions[0].id;
          switchSession(lastId, sessionMap, key);
          setIsInitializing(false);
        }, 0);
      } else {
        await createNewSession(key);
        setTimeout(() => setIsInitializing(false), 0);
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('chat-lab-v3-model');
    if (saved) {
      setTimeout(() => setSelectedModel(validateModel(saved)), 0);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('chat-lab-v3-model', selectedModel);
  }, [selectedModel]);

  // ── Geolocation ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&localityLanguage=en`)
          .then(r => r.json())
          .then(data => data.countryName && setUserCountry(data.countryName));
      },
      () => setUserCountry(null)
    );
  }, []);

  // ── Queue Processor ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!isLoading && pendingQueue.length > 0) {
      const t = setTimeout(() => {
        const next = pendingQueue[0];
        setPendingQueue(prev => prev.slice(1));
        append({
          role: 'user',
          content: next.content,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          experimental_attachments: next.files as any,
        });
      }, 600);
      return () => clearTimeout(t);
    }
  }, [isLoading, pendingQueue, append]);

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = mainRef.current;
    if (!container) return;
    const threshold = 150;
    const isAtBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + threshold;
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: isLoading ? 'auto' : 'smooth' });
    }
  }, [messages, isLoading]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const onChatSubmit = useCallback(async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    const content = input.trim();
    if (!content && (!files || files.length === 0)) return;

    if (!currentSessionId || !encryptionKey) return;

    // ── Serialize Attachments ──────────────────────────────────────────
    const fileArray = files ? Array.from(files) : [];
    const attachments = await Promise.all(fileArray.map(async (file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve({
          name: file.name,
          contentType: file.type,
          url: reader.result as string
        });
        reader.readAsDataURL(file);
      });
    }));

    // Encrypt and save user message to Supabase
    const encryptedContent = await encrypt(content || (fileArray.length ? "Processing attachments..." : ""), encryptionKey);
    
    await supabase.from('messages').insert({
      session_id: currentSessionId,
      role: 'user',
      content: encryptedContent,
      experimental_attachments: attachments
    });

    if (isLoading) {
      setPendingQueue(prev => [...prev, { content, files: fileArray }]);
      setInput('');
      setFiles(undefined);
      return;
    }

    handleSubmit(e, { experimental_attachments: files });
    setFiles(undefined);
  }, [input, files, handleSubmit, isLoading, setInput, currentSessionId, encryptionKey]);

  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <SkeletonMessage />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-foreground font-body transition-colors duration-500 overflow-hidden">
      
      {/* Sidebar */}
      <AnimatePresence initial={false}>
        {isSidebarOpen && (
          <motion.aside 
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="flex-shrink-0 border-r border-border bg-stone-50/50 dark:bg-stone-900/20 flex flex-col overflow-hidden"
          >
            <div className="p-4 flex flex-col h-full">
              <button 
                onClick={() => encryptionKey && createNewSession(encryptionKey)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-foreground text-background rounded-xl font-medium text-sm hover:opacity-90 transition-all active:scale-95 shadow-sm mb-6"
              >
                <Plus size={18} />
                <span>New Chat</span>
              </button>

              <div className="flex-1 overflow-y-auto space-y-1 pr-2 scrollbar-thin">
                <div className="px-2 mb-2">
                  <span className="text-[10px] font-medium text-foreground/40">Recent</span>
                </div>
                {Object.values(sessions).sort((a,b) => b.createdAt - a.createdAt).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => encryptionKey && switchSession(s.id, sessions, encryptionKey)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm transition-all group ${
                      currentSessionId === s.id 
                        ? 'bg-white dark:bg-stone-800 shadow-sm border border-border text-foreground' 
                        : 'text-foreground/50 hover:bg-stone-100 dark:hover:bg-stone-800/50'
                    }`}
                  >
                    <MessageSquare size={16} className={currentSessionId === s.id ? 'text-accent' : 'opacity-40'} />
                    <span className="truncate flex-1 font-normal">{s.title}</span>
                    <Trash2 
                      size={14} 
                      onClick={(e) => deleteSession(s.id, e)}
                      className="opacity-0 group-hover:opacity-40 hover:!opacity-100 hover:text-red-500 transition-all" 
                    />
                  </button>
                ))}
              </div>

              <div className="mt-auto pt-4 border-t border-border/50">
                <div className="flex items-center gap-3 px-3 py-2 opacity-40">
                  <Layout size={16} />
                  <span className="text-xs font-medium">Intelligence Lab v2</span>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col relative overflow-hidden">
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-40 p-1 bg-background border border-border rounded-r-lg shadow-md hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
        >
          {isSidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>

        <Header 
          userCountry={userCountry}
          pendingQueueCount={pendingQueue.length}
          hasMessages={messages.length > 0}
          confirmClear={confirmClear}
          setConfirmClear={setConfirmClear}
          onClear={() => setMessages([])} 
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
        />

        <main ref={mainRef} className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto p-6 md:p-12 w-full">
            <AnimatePresence mode="wait">
              {messages.length === 0 && !error ? (
                <motion.section 
                  key="empty"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex flex-col items-center justify-center py-24 text-center space-y-8"
                >
                  <div className="w-20 h-20 bg-stone-100 dark:bg-stone-900 rounded-3xl flex items-center justify-center mb-4 shadow-inner ring-1 ring-border/50 text-accent">
                    <Sparkles size={40} className="animate-pulse" />
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-4xl font-display tracking-tight text-foreground">
                      Deep Reasoning Interface
                    </h2>
                    <p className="text-stone-500 dark:text-stone-400 max-w-sm mx-auto text-base">
                      Select a research prompt or begin a new exploration.
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
                    {STARTER_MISSIONS.map((mission, idx) => (
                      <motion.button
                        key={idx}
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => append({ role: 'user', content: mission.prompt })}
                        className="px-5 py-2.5 bg-white dark:bg-zinc-900 border border-border rounded-2xl text-sm font-normal text-foreground/60 hover:border-foreground hover:text-foreground transition-all shadow-sm"
                      >
                        {mission.label}
                      </motion.button>
                    ))}
                  </div>
                </motion.section>
              ) : (
                <div className="space-y-2">
                  {messages.map((m) => (
                    <ChatMessage key={m.id} message={m} isTeacher={m.role !== 'user'} />
                  ))}
                  {isLoading && <SkeletonMessage />}
                  
                  {(error || persistedError) && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex flex-col items-center justify-center py-10 px-4 text-center space-y-3"
                    >
                      <p className="text-sm text-foreground/50 font-body">
                        I can&apos;t seem to reach the model right now.
                      </p>
                      <button
                        onClick={() => {
                          setPersistedError(false);
                          reload();
                        }}
                        className="text-xs font-medium text-foreground/80 hover:text-foreground underline underline-offset-4 transition-colors active:scale-95"
                      >
                        Try again
                      </button>
                    </motion.div>
                  )}
                </div>
              )}
            </AnimatePresence>
            <div ref={messagesEndRef} className="h-12" />
          </div>
        </main>

        <InteractionBar 
          input={input}
          handleInputChange={handleInputChange}
          onChatSubmit={onChatSubmit}
          isLoading={isLoading}
          pendingQueue={pendingQueue}
          setPendingQueue={setPendingQueue}
          files={files}
          setFiles={setFiles}
          fileInputRef={fileInputRef}
          textareaRef={textareaRef}
          selectedModel={selectedModel}
        />
      </div>
    </div>
  );
}
