'use client';

import { useChat } from 'ai/react';
import { useRef, useEffect, useState, useCallback } from 'react';
import { ChatMessage } from './ChatMessage';
import { Header } from '@/components/Header';
import { InteractionBar } from '@/components/InteractionBar';
import { SkeletonMessage } from '@/components/SkeletonMessage';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

const STARTER_MISSIONS = [
  { label: "🚀 Space Story", prompt: "Tell me a fun story about a robot exploring Mars!" },
  { label: "🐝 Bee Secret", prompt: "How do bees make honey? Explain it like we are in the garden." },
  { label: "🎨 Art Class", prompt: "What are the primary colors, and how can I mix them to make purple?" },
];

export default function Chat() {
  const [userCountry, setUserCountry] = useState<string | null>(null);
  const [pendingQueue, setPendingQueue] = useState<{ content: string; files?: File[] }[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [files, setFiles] = useState<FileList | undefined>(undefined);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    setMessages,
    setInput,
    append,
  } = useChat({
    body: {
      model: 'gemma4:e4b',
      userCountry,
    },
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Persistence ──────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('chat-adventure');
    if (saved) {
      try { setMessages(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
  }, [setMessages]);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('chat-adventure', JSON.stringify(messages));
    }
  }, [messages]);

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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
      />

      <main className="flex-1 overflow-y-auto">
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
                    A big world of learning awaits!
                  </h2>
                  <p className="text-stone-500 dark:text-stone-400 max-w-sm mx-auto text-base">
                    I&apos;m so glad you&apos;re here. We can talk about anything! Try a starter lesson or ask me a new question.
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
      />
    </div>
  );
}
