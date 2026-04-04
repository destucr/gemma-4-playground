'use client';

import { motion } from 'framer-motion';

/**
 * A minimal, elegant thinking indicator using three pulsing dots.
 * Replaces the 'dialog box' style for a cleaner research interface.
 */
export function SkeletonMessage() {
  return (
    <div className="flex items-center gap-3 mt-4 mb-8 pl-4 animate-in fade-in duration-500">
      {/* Small subtle role identifier */}
      <div className="text-[10px] font-medium text-foreground/40 select-none font-body">
        Thinking
      </div>
      
      {/* Pulsing Dots */}
      <div className="flex gap-1.5">
        <motion.div 
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          className="h-1.5 w-1.5 bg-foreground/40 rounded-full" 
        />
        <motion.div 
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
          className="h-1.5 w-1.5 bg-foreground/40 rounded-full" 
        />
        <motion.div 
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
          className="h-1.5 w-1.5 bg-foreground/40 rounded-full" 
        />
      </div>
    </div>
  );
}
