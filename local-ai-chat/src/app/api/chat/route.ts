import { createOllama } from "ollama-ai-provider";
import { streamText, convertToCoreMessages } from "ai";
import { normalizeOllamaUrl } from "@/lib/utils";
import { agentTools } from "@/lib/agent-tools";

const ollama = createOllama({
  baseURL: normalizeOllamaUrl(process.env.OLLAMA_BASE_URL),
});

// ─── System Prompt Generator ──────────────────────────────────────────────────

function getSystemPrompt(country: string | null) {
  const location = country ? `Location: ${country}.` : "";

  return `<|think|>
    You are a Universal Expert Intelligence. ${location}
    
    TOOL CAPABILITIES:
    - You have direct access to the local file system and shell.
    - Available Tools: readFile, writeFile, listDirectory, runCommand.
    - Always use tools to verify facts about the current project or system.
    
    CORE PRINCIPLES:
    - LINGUISTIC ALIGNMENT: Match your tone to the domain (e.g., empathetic for personal, technical for code).
    - NO PLACEHOLDERS: Deliver finished products, no [brackets].
    - REASONING FIRST: Think step-by-step internally in your thought channel.
  `;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { messages, model, userCountry, isTitleGen } = await req.json();
    const selectedModel = typeof model === "string" ? model : "gemma4:e4b";
    const country = typeof userCountry === "string" ? userCountry : null;

    if (!messages || !Array.isArray(messages)) {
      return new Response("Invalid request", { status: 400 });
    }

    // ─── Title Generation Mode ─────────────────────────────────────────────
    if (isTitleGen) {
      const result = await streamText({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        model: ollama(selectedModel) as any,
        system: "You are a professional research librarian. Your only task is to generate a concise, context-aware title (maximum 30 characters) for the provided conversation or code snippet. Return ONLY the title, no preamble, no quotes, no periods.",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: convertToCoreMessages(messages.slice(-2) as any[]),
      });
      return result.toDataStreamResponse();
    }

    // SLIDING WINDOW: Keep last 10 messages
    const recentMessages = messages.slice(-10);

    const cleanMessages = recentMessages.map((m: { role: string; content: string }) => ({
      ...m,
      content: m.role === 'assistant' 
        ? m.content.replace(/<\|channel>thought[\s\S]*?<channel\|>/g, '').trim()
        : m.content
    }));

    const result = await streamText({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: ollama(selectedModel) as any, // Bypass type mismatch
      system: getSystemPrompt(country),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: convertToCoreMessages(cleanMessages as any[]),
      tools: agentTools,
      maxSteps: 5,
      onStepFinish: ({ toolCalls }) => {
        if (toolCalls && toolCalls.length > 0) {
          console.log(`[Chat API] Tools: ${toolCalls.map(tc => tc.toolName).join(', ')}`);
        }
      },
      onFinish: ({ text, toolCalls }) => {
        console.log(`[Chat API] Done. Text length: ${text.length}, Tool calls: ${toolCalls?.length || 0}`);
      }
    });

    return result.toDataStreamResponse();
  } catch (error: unknown) {
    const err = error as Error & { cause?: unknown };
    console.error("Chat API Error:", err);
    if (err.cause) console.error("Error Cause:", err.cause);
    return new Response(
      `Connection Offline: ${err.message || "Error reaching model."}`,
      { status: 500 },
    );
  }
}
