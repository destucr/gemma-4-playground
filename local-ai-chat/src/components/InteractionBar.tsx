'use client';

import { Paperclip, Send, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface InteractionBarProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onChatSubmit: (e?: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  pendingQueue: { content: string; files?: File[] }[];
  setPendingQueue: React.Dispatch<React.SetStateAction<{ content: string; files?: File[] }[]>>;
  files: FileList | undefined;
  setFiles: (files: FileList | undefined) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  selectedModel: string;
}

export function InteractionBar({
  input,
  handleInputChange,
  onChatSubmit,
  isLoading,
  pendingQueue,
  setPendingQueue,
  files,
  setFiles,
  fileInputRef,
  textareaRef,
  selectedModel
}: InteractionBarProps) {
  
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
    <footer className="w-full bg-background/95 backdrop-blur-xl p-4 pb-8 sticky bottom-0 z-30 border-t border-border/50">
      <div className="max-w-4xl mx-auto">
        
        {/* Queued Prompts - Staggered List */}
        <AnimatePresence>
          {pendingQueue.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="mb-6 space-y-3"
            >
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold tracking-widest text-stone-500">Up next in queue</span>
                </div>
                <button 
                  onClick={() => setPendingQueue([])}
                  className="text-[10px] font-bold text-stone-400 hover:text-red-500 transition-colors tracking-tighter"
                >
                  Clear all
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {pendingQueue.map((q, idx) => (
                  <motion.div 
                    layout
                    key={idx} 
                    className="flex items-center gap-3 bg-stone-100 dark:bg-stone-900 border border-border/50 p-2 rounded-xl opacity-70 hover:opacity-100 transition-all group"
                  >
                    <div className="flex-shrink-0 w-6 h-6 bg-background rounded-lg flex items-center justify-center text-[10px] font-bold text-stone-400 border border-border shadow-sm">
                      {idx + 1}
                    </div>
                    <p className="text-xs text-stone-600 dark:text-stone-400 truncate flex-1 font-medium">
                      {q.content || (q.files?.length ? `[${q.files.length} files attached]` : "Empty message")}
                    </p>
                    <button 
                      onClick={() => setPendingQueue((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 text-stone-400 hover:text-red-500 rounded-lg transition-all"
                    >
                      <X size={14} />
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Attachment Previews */}
        <AnimatePresence>
          {files && files.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-4 flex gap-2 overflow-x-auto pb-2 px-1 scrollbar-none"
            >
              {Array.from(files).map((f, i) => (
                <div key={i} className="flex-shrink-0 text-[11px] font-medium bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-300 px-3 py-2 rounded-xl border border-border flex items-center gap-3 shadow-sm group">
                  <Paperclip size={12} className="text-stone-400" />
                  <span className="truncate max-w-[140px] font-semibold">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const dt = new DataTransfer();
                      Array.from(files).filter((_, idx) => idx !== i).forEach(file => dt.items.add(file));
                      setFiles(dt.files.length > 0 ? dt.files : undefined);
                    }}
                    className="text-stone-300 hover:text-red-500 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <form
          onSubmit={onChatSubmit}
          className="relative flex gap-2 items-center bg-white dark:bg-zinc-900 p-1.5 rounded-2xl border border-border shadow-md focus-within:ring-2 focus-within:ring-foreground/10 transition-all"
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
            className="p-2.5 text-foreground/60 hover:text-foreground hover:bg-stone-50 dark:hover:bg-stone-800 rounded-xl transition-all active:scale-90 flex-shrink-0"
            aria-label="Attach files"
          >
            <Paperclip size={18} />
          </button>

          <div className="flex-1">
            <textarea
              ref={textareaRef}
              rows={1}
              className="w-full py-2 px-1 bg-transparent border-none outline-none text-[15px] resize-none overflow-hidden leading-normal placeholder:text-foreground/50 font-medium align-middle dark:text-foreground"
              value={input}
              placeholder={pendingQueue.length > 0 ? "Add to your queue..." : "Enter research query or code request..."}
              onChange={handleInputChange}
              onKeyDown={onKeyDown}
              autoComplete="off"
              style={{ maxHeight: '120px' }}
            />
          </div>

          <button
            type="submit"
            className={`p-2.5 rounded-xl transition-all shadow-lg active:scale-95 flex-shrink-0 border border-transparent ${
              isLoading 
                ? 'bg-stone-100 dark:bg-stone-800 text-foreground/40' 
                : 'bg-foreground dark:bg-background text-background dark:text-foreground hover:opacity-90'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            disabled={!input.trim() && (!files || files.length === 0)}
          >
            {isLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Send size={18} />
            )}
          </button>
        </form>
        
        <div className="text-center mt-4">
          <p className="text-[10px] text-foreground/60 font-thin tracking-widest opacity-80">
            Technical Research Interface • {selectedModel === 'auto' ? 'Gemma 4 (26b) • Auto' : selectedModel === 'gemma4:e4b' ? 'Gemma 4 (4b)' : 'Gemma 4 (26b)'}
          </p>
        </div>
      </div>
    </footer>
  );
}
