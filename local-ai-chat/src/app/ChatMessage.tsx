'use client';

import { Message } from 'ai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useState } from 'react';

interface ChatMessageProps {
  message: Message;
  isTeacher: boolean;
}

/**
 * ChatMessage component for rendering individual messages with copy functionality.
 */
export function ChatMessage({ message, isTeacher }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <article
      className={`flex ${!isTeacher ? 'justify-end' : 'justify-start'} group mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300`}
      aria-label={`${isTeacher ? 'Teacher' : 'Your'} message`}
    >
      <div
        className={`max-w-[85%] p-4 rounded-2xl shadow-sm relative transition-all duration-200 hover:shadow-md ${
          !isTeacher
            ? 'bg-blue-600 text-white rounded-tr-none'
            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 rounded-tl-none'
        }`}
      >
        <header className="flex items-center justify-between mb-1 gap-4">
          <span className={`font-semibold text-[10px] uppercase tracking-wider select-none opacity-80 ${
            !isTeacher ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
          }`}>
            {isTeacher ? 'Teacher Gemma' : 'You'}
          </span>
          
          {/* Copy Button - Visible on hover or when recently copied */}
          <button
            onClick={copyToClipboard}
            className={`transition-opacity p-1 rounded-md hover:bg-black/10 dark:hover:bg-white/10 ${
              copied ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
            }`}
            title="Copy message"
            aria-label="Copy message"
          >
            {copied ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
            )}
          </button>
        </header>
        
        <div className={`leading-relaxed text-sm md:text-base prose prose-sm max-w-none dark:prose-invert ${
          !isTeacher ? 'prose-invert' : ''
        }`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content}
          </ReactMarkdown>
        </div>

        {/* Render Attachments */}
        {message.experimental_attachments?.map((attachment, index) => (
          <div key={`${message.id}-${index}`} className="mt-3 overflow-hidden rounded-lg">
            {attachment.contentType?.startsWith('image/') && (
              // eslint-disable-next-line @next/next/no-img-element
              <img 
                src={attachment.url} 
                alt="Attachment" 
                className="max-w-full h-auto border border-white/10" 
              />
            )}
            {attachment.contentType?.startsWith('audio/') && (
              <audio src={attachment.url} controls className="w-full h-8" />
            )}
          </div>
        ))}
      </div>
    </article>
  );
}
