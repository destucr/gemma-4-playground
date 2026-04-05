'use client';

import { Message } from 'ai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion } from 'framer-motion';
import { Copy, Check, User, Sparkles } from 'lucide-react';

interface ChatMessageProps {
  message: Message;
  isTeacher: boolean;
}

/**
 * ChatMessage component for rendering individual messages with robust rendering and no 'pre-selected' look.
 */
export function ChatMessage({ message, isTeacher }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);

  // Extract thought block if present
  const thoughtMatch = /<\|channel>thought([\s\S]*?)<channel\|>/.exec(message.content);
  const thoughtContent = thoughtMatch ? thoughtMatch[1].trim() : null;
  const visibleContent = message.content.replace(/<\|channel>thought[\s\S]*?<channel\|>/, '').trim();

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(visibleContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className={`flex ${!isTeacher ? 'justify-end' : 'justify-start'} group mb-12 relative`}
      aria-label={`${isTeacher ? 'Teacher' : 'Your'} message`}
    >
      {/* Role Indicator - Overlapping Aesthetic */}
      <div className={`absolute -top-3.5 ${!isTeacher ? 'right-4' : 'left-4'} z-10 flex items-center gap-1.5 px-2.5 py-1 bg-background border border-border rounded-full shadow-sm`}>
        {isTeacher ? (
          <>
            <Sparkles size={10} className="text-foreground" />
            <span className="text-[10px] text-foreground font-normal tracking-wide">Gemma 4 (4b)</span>
          </>
        ) : (
          <>
            <User size={10} className="text-foreground/60" />
            <span className="text-[10px] text-foreground font-normal tracking-wide">You</span>
          </>
        )}
      </div>

      <div
        className={`relative transition-all duration-300 flex flex-col ${
          !isTeacher
            ? 'bg-[#121212] text-[#fcfaf7] rounded-2xl rounded-tr-none px-6 pt-5 pb-4 max-w-[85%] shadow-lg'
            : 'bg-white dark:bg-[#1e1e1e] border border-border text-[#121212] dark:text-[#fcfaf7] rounded-2xl rounded-tl-none px-6 pt-6 pb-4 max-w-[85%] shadow-sm hover:shadow-md'
        }`}
      >
        {/* Internal Reasoning (Thought Channel) */}
        {isTeacher && thoughtContent && (
          <div className="mb-6 pb-6 border-b border-border/50">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 bg-foreground/20 rounded-full" />
              <span className="text-[10px] font-bold tracking-widest text-foreground/40 uppercase">Internal Reasoning</span>
            </div>
            <div className="text-xs text-foreground/50 font-mono leading-relaxed bg-black/5 dark:bg-white/5 p-4 rounded-xl italic">
              {thoughtContent}
            </div>
          </div>
        )}

        <div className={`leading-relaxed text-[15px] md:text-base prose prose-slate max-w-none flex-1 ${
          !isTeacher 
            ? 'prose-invert prose-p:text-[#fcfaf7] prose-headings:text-[#fcfaf7] prose-strong:text-white prose-code:text-[#fcfaf7] prose-code:bg-transparent prose-code:before:content-none prose-code:after:content-none' 
            : 'dark:prose-invert prose-p:text-[#121212] dark:prose-p:text-[#fcfaf7] prose-headings:text-[#121212] dark:prose-headings:text-white prose-code:text-[#121212] dark:prose-code:text-[#fcfaf7] prose-code:bg-transparent prose-code:before:content-none prose-code:after:content-none'
        }`}>
          <ReactMarkdown 
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeRaw, rehypeKatex]}
            components={{
              code(props) {
                const { children, className, ...rest } = props;
                const match = /language-(\w+)/.exec(className || '');
                const isMultiline = String(children).includes('\n');

                if (match || isMultiline) {
                  return (
                    <div className="relative group/code my-6">
                      <SyntaxHighlighter
                        {...rest}
                        PreTag="div"
                        language={match ? match[1] : 'text'}
                        style={oneDark}
                        className="rounded-xl shadow-lg border border-black/20 !bg-[#1e1e1e]"
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    </div>
                  );
                }

                // Inline code: NO background to avoid the 'selected' look
                return (
                  <code 
                    {...rest} 
                    className={`${!isTeacher ? 'text-white' : 'text-[#121212] dark:text-[#fcfaf7]'} font-mono text-[0.95em] font-medium`}
                  >
                    {children}
                  </code>
                );
              }
            }}
          >
            {visibleContent}
          </ReactMarkdown>
        </div>

        {/* Render Attachments */}
        {message.experimental_attachments?.map((attachment, index) => (
          <div key={`${message.id}-${index}`} className="mt-4 overflow-hidden rounded-xl border border-border/50 shadow-inner bg-stone-50 dark:bg-stone-950/50 p-1">
            {attachment.contentType?.startsWith('image/') && (
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                src={attachment.url} 
                alt="Attachment" 
                className="max-w-full h-auto rounded-lg" 
              />
            )}
            {attachment.contentType?.startsWith('audio/') && (
              <audio src={attachment.url} controls className="w-full h-10 px-2" />
            )}
          </div>
        ))}

        {/* Hanging Copy Button - Positioned absolutely outside the bubble */}
        <div className={`absolute -bottom-9 ${!isTeacher ? 'left-0' : 'right-0'} flex items-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`}>
          <button
            onClick={copyToClipboard}
            className={`pointer-events-auto p-1.5 rounded-lg bg-background border border-border shadow-sm hover:bg-stone-100 dark:hover:bg-stone-800 transition-all ${copied ? 'text-green-500' : 'text-foreground/40'}`}
            title="Copy message"
          >
            <div className="flex items-center gap-1.5 px-1.5">
              {copied ? <Check size={12} /> : <Copy size={12} />}
              <span className="text-[9px] font-normal tracking-wide">Copy</span>
            </div>
          </button>
        </div>
      </div>
    </motion.article>
  );
}
