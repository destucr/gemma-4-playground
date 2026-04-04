'use client';

import { MapPin, Sparkles, Trash2, X } from 'lucide-react';

interface HeaderProps {
  userCountry: string | null;
  pendingQueueCount: number;
  hasMessages: boolean;
  confirmClear: boolean;
  setConfirmClear: (val: boolean) => void;
  onClear: () => void;
}

export function Header({
  userCountry,
  pendingQueueCount,
  hasMessages,
  confirmClear,
  setConfirmClear,
  onClear
}: HeaderProps) {
  return (
    <header className="w-full bg-background/80 backdrop-blur-md border-b border-border p-4 sticky top-0 z-30 shadow-sm transition-all duration-300">
      <div className="flex items-center justify-between px-4 md:px-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-foreground text-background rounded-lg flex items-center justify-center shadow-inner ring-1 ring-border/50 transition-transform hover:scale-105 active:scale-95">
            <Sparkles size={20} className="text-accent" />
          </div>
          
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-base font-body tracking-tight text-foreground/90 leading-none font-normal">
                  Playground Gemma 4
                </h1>
                {userCountry && (
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-stone-100 dark:bg-zinc-800 rounded-full border border-border/60">
                    <MapPin size={10} className="text-foreground/60" />
                    <span className="text-[10px] font-normal text-foreground/70 tracking-wider">
                      {userCountry}
                    </span>
                  </div>
                )}
              </div>
              <span className="text-[11px] font-body text-foreground/60 mt-0.5 font-normal">
                Gemma 4 (4b)
              </span>
            </div>
            </div>

            <div className="flex items-center gap-3 min-h-[36px]">
            {pendingQueueCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-foreground dark:bg-background rounded-full animate-pulse shadow-md">
              <div className="w-1.5 h-1.5 bg-background dark:bg-foreground rounded-full" />
              <span className="text-[10px] font-normal text-background dark:text-foreground tracking-tight">
                Queued: {pendingQueueCount}
              </span>
            </div>
            )}

                {hasMessages && (
                confirmClear ? (
                <div className="flex items-center gap-3 text-xs animate-in fade-in slide-in-from-right-2 duration-200 bg-stone-100 dark:bg-zinc-800 px-3 py-1.5 rounded-lg border border-border shadow-inner">
                  <span className="text-foreground/50 font-regular">Clear conversation?</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onClear}
                    className="text-red-600 dark:text-red-400 font-bold hover:opacity-70 transition-opacity"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="text-stone-400 hover:text-stone-600 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmClear(true)}
                className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-all active:scale-90"
                title="Clear Session"
              >
                <Trash2 size={18} />
              </button>
            )
          )}
        </div>
      </div>
    </header>
  );
}
