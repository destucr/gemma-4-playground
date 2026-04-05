'use client';

import { useChat } from 'ai/react';
import { useRef, useEffect, useState, useCallback } from 'react';
import { ChatMessage } from './ChatMessage';
import { Header } from '@/components/Header';
import { InteractionBar } from '@/components/InteractionBar';
import { SkeletonMessage } from '@/components/SkeletonMessage';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { validateModel } from '@/lib/utils';

const STARTER_MISSIONS = [
  { label: "🏗️ System Design", prompt: "Design a high-performance distributed caching layer for a social media platform." },
  { label: "⚡ Code Optimization", prompt: "Explain how to optimize a Go service for low-latency message processing." },
  { label: "🛡️ Security Audit", prompt: "What are the core security principles for designing a zero-trust architecture?" },
];

export default function Chat() {
  const [userCountry, setUserCountry] = useState<string | null>(null);
  const [pendingQueue, setPendingQueue] = useState<{ content: string; files?: File[] }[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const [persistedError, setPersistedError] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('auto');

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
    body: {
      model: selectedModel === 'auto' ? 'gemma4:26b' : selectedModel,
      userCountry,
    },
    onError: () => setPersistedError(true),
    onResponse: () => setPersistedError(false),
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Persistence ──────────────────────────────────────────────────────────
  // Load on mount
  useEffect(() => {
    const saved = localStorage.getItem('chat-adventure');
    if (saved) {
      try { 
        const { messages: savedMessages, hasError, modelPref } = JSON.parse(saved);
        if (savedMessages) setMessages(savedMessages);
        if (hasError) setTimeout(() => setPersistedError(true), 0);
        
        // Validate restored preference to avoid stale/wrong model names
        const validated = validateModel(modelPref);
        setTimeout(() => setSelectedModel(validated), 0);
      } catch { 
        // Fallback for old schema
        try { setMessages(JSON.parse(saved)); } catch (err) { console.error(err); }
      }
    }
  }, [setMessages]);

  // Save on change
  useEffect(() => {
    if (messages.length > 0 || error || persistedError || selectedModel !== 'auto') {
      localStorage.setItem('chat-adventure', JSON.stringify({ 
        messages, 
        hasError: !!error || persistedError,
        modelPref: selectedModel
      }));
    }
  }, [messages, error, persistedError, selectedModel]);

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
      // Use 'auto' instead of 'smooth' during loading to prevent jank
      messagesEndRef.current?.scrollIntoView({ behavior: isLoading ? 'auto' : 'smooth' });
    }
  }, [messages, isLoading]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const onChatSubmit = useCallback((e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    const content = input.trim();
    if (!content && (!files || files.length === 0)) return;

    if (isLoading) {
      setPendingQueue(prev => [...prev, { content, files: files ? Array.from(files) : undefined }]);
      setInput('');
      setFiles(undefined);
      return;
    }

    handleSubmit(e, { experimental_attachments: files });
    setFiles(undefined);
  }, [input, files, handleSubmit, isLoading, setInput]);

  const clearSession = () => {
    setMessages([]);
    setConfirmClear(false);
    setPendingQueue([]);
    localStorage.removeItem('chat-adventure');
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-body transition-colors duration-500">
      
      <Header 
        userCountry={userCountry}
        pendingQueueCount={pendingQueue.length}
        hasMessages={messages.length > 0}
        confirmClear={confirmClear}
        setConfirmClear={setConfirmClear}
        onClear={clearSession}
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
                <div className="w-20 h-20 bg-stone-100 dark:bg-stone-900 rounded-3xl flex items-center justify-center mb-4 shadow-inner ring-1 ring-border/50">
                  <Sparkles size={40} className="text-accent animate-pulse" />
                </div>
                <div className="space-y-3">
                  <h2 className="text-4xl font-display tracking-tight text-foreground">
                    Deep Reasoning Interface
                  </h2>
                  <p className="text-stone-500 dark:text-stone-400 max-w-sm mx-auto text-base">
                    The local model is initialized and ready for technical research, code generation, and complex analysis.
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
                  {STARTER_MISSIONS.map((mission, idx) => (
                    <motion.button
                      key={idx}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => append({ role: 'user', content: mission.prompt })}
                      className="px-5 py-2.5 bg-white dark:bg-zinc-900 border border-border rounded-2xl text-sm font-semibold text-foreground/60 hover:border-foreground hover:text-foreground transition-all shadow-sm"
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
  );
}
