'use client';

import { useChat } from 'ai/react';
import { useRef, useEffect, useState, useCallback } from 'react';
import { ChatMessage } from './ChatMessage';

// ─── Thinking Phases (Professional) ──────────────────────────────────────────
const THINKING_PHASES: { duration: number; texts: string[] }[] = [
  { duration: 800, texts: ["Initializing...", "Parsing request...", "Analyzing context..."] },
  { duration: 1500, texts: ["Allocating resources...", "Loading model weights...", "Structuring parameters..."] },
  { duration: 2500, texts: ["Generating response...", "Synthesizing output...", "Compiling logic..."] },
  { duration: Infinity, texts: ["Refining details...", "Performing complex reasoning...", "Finalizing output..."] },
];

const STARTER_MISSIONS = [
  { label: "🚀 Space Story", prompt: "Tell me a fun story about a robot exploring Mars!" },
  { label: "🐝 Bee Secret", prompt: "How do bees make honey? Explain it like we are in the garden." },
  { label: "🎨 Art Class", prompt: "What are the primary colors, and how can I mix them to make purple?" },
];

// Deterministic hash → stable index per prompt
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Senior-level Chat component with:
 * - Input Queuing (Type while generating)
 * - Multi-phase thinking spinner
 * - Auto-resize textarea
 * - User Geolocation (Country)
 * - Tactile, professional UI
 */
export default function Chat() {
  const [userCountry, setUserCountry] = useState<string | null>(null);
  
  // ── Queue State ──────────────────────────────────────────────────────────
  const [pendingQueue, setPendingQueue] = useState<{ content: string; files?: File[] }[]>([]);

  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    stop,
    reload,
    setMessages,
    setInput,
    append,
  } = useChat({
    body: {
      model: 'gemma4:e4b',
      userCountry,
    },
  });

  // ── Persistence ──────────────────────────────────────────────────────────
  // Load on mount
  useEffect(() => {
    const saved = localStorage.getItem('chat-adventure');
    if (saved) {
      try { setMessages(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
  }, [setMessages]);

  // Save on change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('chat-adventure', JSON.stringify(messages));
    }
  }, [messages]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [activePrompt, setActivePrompt] = useState('');
  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const [confirmClear, setConfirmClear] = useState(false);

  // ── User Geolocation ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) return;
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&localityLanguage=en`)
          .then(r => r.json())
          .then(data => {
            if (data.countryName) {
              setUserCountry(data.countryName);
            }
          })
          .catch(err => console.error('Geocode Error:', err));
      },
      () => setUserCountry(null)
    );
  }, []);

  // ── Multi-phase spinner state ──────────────────────────────────────────────
  const [phaseIndex, setPhaseIndex] = useState(0);

  const seed = hashString(activePrompt || "initializing");
  const currentPhase = THINKING_PHASES[phaseIndex] || THINKING_PHASES[0];
  const thinkingText = currentPhase.texts[seed % currentPhase.texts.length];

  const [prevIsLoading, setPrevIsLoading] = useState(isLoading);
  if (isLoading !== prevIsLoading) {
    setPrevIsLoading(isLoading);
    if (!isLoading) {
      setPhaseIndex(0);
    }
  }

  // ── Queue Processor ──────────────────────────────────────────────────────
  useEffect(() => {
    // If we just finished loading and there's something in the queue, process it
    if (!isLoading && pendingQueue.length > 0) {
      const t = setTimeout(() => {
        const next = pendingQueue[0];
        setPendingQueue(prev => prev.slice(1));
        
        // Execute the next prompt via append() - most reliable for programmatic trigger
        setPhaseIndex(0);
        setActivePrompt(next.content || (next.files?.length ? "Processing attachments..." : ""));
        
        append({
          role: 'user',
          content: next.content,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          experimental_attachments: next.files as any,
        });
      }, 500); // Small delay between responses for better UI flow
      return () => clearTimeout(t);
    }
  }, [isLoading, pendingQueue, append]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  // Multi-phase spinner increments
  useEffect(() => {
    if (!isLoading) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    let cumulative = 0;

    THINKING_PHASES.forEach((phase, idx) => {
      if (idx === 0 || phase.duration === Infinity) return;
      cumulative += THINKING_PHASES[idx - 1].duration;
      timers.push(
        setTimeout(() => {
          setPhaseIndex(idx);
        }, cumulative)
      );
    });

    return () => timers.forEach(t => clearTimeout(t));
  }, [isLoading]);

  const onChatSubmit = useCallback((e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    
    const content = input.trim();
    if (!content && (!files || files.length === 0)) return;

    // IF BUSY: Add to Queue
    if (isLoading) {
      setPendingQueue(prev => [...prev, { content, files: files ? Array.from(files) : undefined }]);
      setInput('');
      setFiles(undefined);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // IF IDLE: Process immediately
    setPhaseIndex(0);
    setActivePrompt(content || (files?.length ? "Processing attachments..." : ""));
    handleSubmit(e, { experimental_attachments: files });
    setFiles(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [input, files, handleSubmit, isLoading, setInput]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onChatSubmit();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFiles(e.target.files);
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans transition-colors duration-300">

      {/* Sleek Header */}
      <header className="w-full bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 p-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-zinc-900 dark:bg-zinc-100 rounded-md flex items-center justify-center text-zinc-50 dark:text-zinc-900 shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M9.315 7.584C12.195 3.883 16.695 1.5 21.5 1.5a.75.75 0 04-.75.75c0 5.056-2.146 9.68-5.655 12.973-1.666 1.564-3.567 2.825-5.632 3.693l-2.022.846a.75.75 0 01-1.025-.86l.666-2.585A14.931 14.931 0 016.5 13.5c-3.144 0-6.096-1.066-8.435-2.888a.75.75 0 01.378-1.341c4.542.42 9.076-.176 12.872-1.687z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Local Environment</h1>
                {userCountry && (
                  <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 font-bold tracking-tight">
                    {userCountry}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">Gemma 4 (4b) • Active</span>
            </div>
          </div>

          <div className="flex items-center gap-2 min-h-[32px]">
            {pendingQueue.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 bg-zinc-900 dark:bg-zinc-100 rounded-full animate-pulse shadow-sm">
                <div className="w-1.5 h-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-full" />
                <span className="text-[10px] font-bold text-zinc-100 dark:text-zinc-900">Queued: {pendingQueue.length}</span>
              </div>
            )}
            
            {messages.length > 0 && (
              confirmClear ? (
                <div className="flex items-center gap-3 text-sm animate-in fade-in slide-in-from-right-2 duration-150 bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-md shadow-inner">
                  <span className="text-zinc-600 dark:text-zinc-400 font-medium">Clear session?</span>
                  <button
                    onClick={() => { 
                      setMessages([]); 
                      setConfirmClear(false); 
                      setPendingQueue([]); 
                      localStorage.removeItem('chat-adventure');
                    }}
                    className="text-red-600 dark:text-red-400 font-bold hover:opacity-80 transition-opacity"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="text-zinc-600 dark:text-zinc-300 font-medium hover:opacity-80 transition-opacity"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmClear(true)}
                  className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-all active:scale-95"
                  title="Clear Session"
                  aria-label="Clear Session"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )
            )}
          </div>
        </div>
      </header>

      {/* Main Chat Area - Scrollbar at Edge */}
      <main className="flex-1 overflow-y-auto w-full">
        {/* Centered Content Wrapper */}
        <div className="max-w-4xl mx-auto p-4 md:p-8 w-full min-h-full">
          {messages.length === 0 && !error && (
            <section className="flex flex-col items-center justify-center py-20 text-center space-y-3 animate-in fade-in duration-500">
              <div className="w-16 h-16 bg-zinc-200/50 dark:bg-zinc-800/50 rounded-2xl flex items-center justify-center mb-2 shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-zinc-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200">Gemma 4 Ready</h2>
              <p className="text-zinc-500 dark:text-zinc-400 max-w-sm text-sm">
                Model loaded into local memory. Enter a prompt or attach context files to begin.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-2 mt-6 max-w-lg">
                {STARTER_MISSIONS.map((mission, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setPhaseIndex(0);
                      setActivePrompt(mission.prompt);
                      append({ role: 'user', content: mission.prompt });
                    }}
                    className="px-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-200 transition-all shadow-sm active:scale-95"
                  >
                    {mission.label}
                  </button>
                ))}
              </div>
              </section>          )}

          <div className="space-y-6">
            {messages.map((m) => (
              <ChatMessage
                key={m.id}
                message={m}
                isTeacher={m.role !== 'user'}
              />
            ))}
          </div>

          {isLoading && (
            <div className="flex justify-start items-end gap-3 mt-6 mb-4">
              <div className="bg-white dark:bg-zinc-800/80 backdrop-blur-sm border border-zinc-200 dark:border-zinc-700/50 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex flex-col gap-2 min-w-[200px]">

                <div className="flex gap-1 mb-1">
                  {THINKING_PHASES.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 rounded-full transition-all duration-500 ${i <= phaseIndex
                          ? 'bg-zinc-700 dark:bg-zinc-300 flex-[2]'
                          : 'bg-zinc-200 dark:bg-zinc-700 flex-1'
                        }`}
                    />
                  ))}
                </div>

                <span
                  key={thinkingText}
                  className="text-[11px] font-bold tracking-wider text-zinc-600 dark:text-zinc-400"
                  style={{ animation: 'thinkingFadeIn 0.3s ease-out' }}
                >
                  {thinkingText}
                </span>

                <div className="flex gap-1.5 mt-0.5">
                  <div className="h-1.5 w-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce"></div>
                  <div className="h-1.5 w-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce [animation-delay:-.15s]"></div>
                  <div className="h-1.5 w-1.5 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-bounce [animation-delay:-.3s]"></div>
                </div>
              </div>

              <button
                onClick={stop}
                className="mb-1 p-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all shadow-sm active:scale-90"
                title="Halt Generation"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v6a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}

          {error && (
            <section className="mt-6 p-4 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-300 text-sm flex flex-col gap-3 shadow-inner" role="alert">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <p className="font-semibold text-base">Connection Offline</p>
              </div>
              <p className="text-zinc-600 dark:text-zinc-400">Unable to establish a connection with the local model. Verify that your runtime (e.g., Ollama) is active and the specified model is pulled.</p>
              <button
                onClick={() => reload()}
                className="bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 px-4 py-2 rounded-lg font-medium transition-all w-fit shadow-md active:scale-95"
              >
                Reconnect
              </button>
            </section>
          )}

          <div ref={messagesEndRef} aria-hidden="true" className="h-4" />
        </div>
      </main>

      {/* Footer / Input - Full Width Background */}
      <footer className="w-full bg-zinc-50 dark:bg-zinc-950 p-4 pb-6 md:pb-8 sticky bottom-0 z-20">
        <div className="flex items-center justify-between px-4 md:px-8">
          <div className="max-w-4xl mx-auto w-full">
            
            {/* Queued Prompts Preview */}
            {pendingQueue.length > 0 && (
              <div className="mb-4 space-y-2 animate-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-pulse" />
                    <span className="text-[10px] font-bold tracking-widest text-zinc-500 dark:text-zinc-400">Up next in queue</span>
                  </div>
                  <button 
                    onClick={() => setPendingQueue([])}
                    className="text-[10px] font-bold text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    Clear all
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {pendingQueue.map((q, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/50 p-2.5 rounded-xl opacity-60 hover:opacity-100 transition-opacity">
                      <div className="flex-shrink-0 w-6 h-6 bg-zinc-200 dark:bg-zinc-800 rounded-lg flex items-center justify-center text-[10px] font-bold text-zinc-500">
                        {idx + 1}
                      </div>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate flex-1">
                        {q.content || (q.files?.length ? `[${q.files.length} files attached]` : "Empty message")}
                      </p>
                      <button 
                        onClick={() => setPendingQueue(prev => prev.filter((_, i) => i !== idx))}
                        className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 text-zinc-400 hover:text-red-500 rounded-md transition-colors"
                        title="Remove from queue"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {files && files.length > 0 && (
              <div className="mb-3 flex gap-2 overflow-x-auto pb-2 px-1 scrollbar-none">
                {Array.from(files).map((f, i) => (
                  <div key={i} className="text-[11px] font-medium bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 flex items-center gap-2 shadow-sm">
                    <span className="truncate max-w-[120px]">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        const dt = new DataTransfer();
                        Array.from(files).filter((_, idx) => idx !== i).forEach(file => dt.items.add(file));
                        setFiles(dt.files.length > 0 ? dt.files : undefined);
                      }}
                      className="text-zinc-400 hover:text-red-500 transition-colors ml-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form
              onSubmit={onChatSubmit}
              className="flex gap-2 items-end bg-white dark:bg-zinc-900 p-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm transition-all focus-within:ring-2 focus-within:ring-zinc-400 dark:focus-within:ring-zinc-600 focus-within:border-transparent"
            >
              <input
                type="file"
                className="hidden"
                ref={fileInputRef}
                multiple
                onChange={handleFileChange}
                accept="image/*,audio/*,text/*,.pdf"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all active:scale-95 flex-shrink-0 self-center"
                aria-label="Attach files"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13" />
                </svg>
              </button>

              <div className="flex-1 py-1">
                <label htmlFor="chat-input" className="sr-only">Your message</label>
                <textarea
                  id="chat-input"
                  ref={textareaRef}
                  rows={1}
                  className="w-full py-2 px-2 bg-transparent border-none outline-none text-[15px] resize-none overflow-hidden leading-relaxed placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                  value={input}
                  placeholder={pendingQueue.length > 0 ? "Add more to queue..." : "Message local environment..."}
                  onChange={handleInputChange}
                  onKeyDown={onKeyDown}
                  autoComplete="off"
                  style={{ maxHeight: '160px' }}
                />
              </div>

              <button
                type="submit"
                className={`p-3 rounded-xl font-bold transition-all shadow-md active:scale-95 flex-shrink-0 self-end border border-transparent ${
                  isLoading 
                    ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500' 
                    : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200'
                } disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-600 disabled:border-zinc-200 dark:disabled:border-zinc-700`}
                disabled={!input.trim() && (!files || files.length === 0)}
                aria-label={isLoading ? "Queue message" : "Send message"}
              >
                {isLoading ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 animate-spin">
                    <path fillRule="evenodd" d="M4.755 10.059a7.5 7.5 0 0 1 12.548-3.364l1.903 1.903h-3.183a.75.75 0 1 0 0 1.5h4.992a.75.75 0 0 0 .75-.75V4.356a.75.75 0 0 0-1.5 0v3.18l-1.9-1.9A9 9 0 0 0 3.306 9.67a.75.75 0 1 0 1.45.388Zm15.408 3.352a.75.75 0 0 0-.919.53 7.5 7.5 0 0 1-12.548 3.364l-1.902-1.903h3.183a.75.75 0 0 0 0-1.5H2.984a.75.75 0 0 0-.75.75v4.992a.75.75 0 0 0 1.5 0v-3.18l1.9 1.9a9 9 0 0 0 15.059-4.035.75.75 0 0 0-.53-.918Z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                  </svg>
                )}
              </button>
            </form>
            <div className="text-center mt-3">
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">Responses generated locally. Verify important information.</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
