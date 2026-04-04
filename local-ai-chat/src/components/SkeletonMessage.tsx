'use client';

import { motion } from 'framer-motion';

export function SkeletonMessage() {
  return (
    <div className="flex justify-start items-end gap-4 mt-6 mb-8 animate-in fade-in duration-500">
      <div className="w-10 h-10 bg-stone-200 dark:bg-stone-800 rounded-lg flex-shrink-0 shadow-inner" />
      
      <div className="bg-white dark:bg-stone-900 border border-border px-5 py-4 rounded-2xl rounded-tl-sm shadow-sm flex flex-col gap-3 min-w-[240px] max-w-[60%]">
        {/* Animated Skeleton Lines */}
        <div className="space-y-2">
          <motion.div 
            initial={{ opacity: 0.3 }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="h-2.5 bg-stone-100 dark:bg-stone-800 rounded-full w-[90%]" 
          />
          <motion.div 
            initial={{ opacity: 0.3 }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
            className="h-2.5 bg-stone-100 dark:bg-stone-800 rounded-full w-[75%]" 
          />
          <motion.div 
            initial={{ opacity: 0.3 }}
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
            className="h-2.5 bg-stone-100 dark:bg-stone-800 rounded-full w-[85%]" 
          />
        </div>

        {/* Pulse Indicator */}
        <div className="flex gap-1.5 mt-1">
          <div className="h-1.5 w-1.5 bg-accent/40 rounded-full animate-bounce" />
          <div className="h-1.5 w-1.5 bg-accent/40 rounded-full animate-bounce [animation-delay:-.15s]" />
          <div className="h-1.5 w-1.5 bg-accent/40 rounded-full animate-bounce [animation-delay:-.3s]" />
        </div>
      </div>
    </div>
  );
}
