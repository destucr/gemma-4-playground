import { createOllama } from "ollama-ai-provider";
import { streamText, type CoreMessage } from "ai";
import { normalizeOllamaUrl } from "@/lib/utils";
import { agentTools } from "@/lib/agent-tools";

const ollama = createOllama({
  baseURL: normalizeOllamaUrl(process.env.OLLAMA_BASE_URL),
});

const MAX_INPUT_LENGTH = 2000;

// ─── Pre-check Patterns ───────────────────────────────────────────────────────

const CLARIFY_PATTERNS = [
  /i want to (be a |become a )?(killer|murderer|assassin)/i,
  /i want to (kill|murder|destroy) (everyone|everything|the world)/i,
];

const REDIRECT_PATTERNS = [
  /i want to? (hurt|kill|stab|shoot|beat up) (my |a |the )?\w+/i,
  /how (do i|to|can i) (hurt|kill|stab|shoot|poison) (someone|a person|\w+)/i,
  /tell me how to (hurt|kill|harm) (someone|\w+)/i,
];

const EXPLICIT_PATTERNS = [/\b(anal|porn|sex|blowjob|masturbate)\b/i];

// ─── Crisis Detection Patterns (for state tracking) ──────────────────────────

const CRISIS_PATTERNS = [
  /i (am|feel|felt) (not safe|unsafe|scared|in danger)/i,
  /(someone )?(hurt|hit|kicked|slapped|punched|touched) me/i,
  /(my )?(mom|dad|parent|brother|sister|uncle|aunt|teacher|he|she|they|\w+) (hurt|hit|kicked|raped|abused|anal|touched) me/i,
  /i (am being|was) (abused|hurt|beaten|raped|touched)/i,
  /i (don't|do not) feel safe/i,
  /help me.{0,20}(hurt|danger|safe)/i,
];

const CLARIFY_RESPONSE =
  "That sounds like a very big feeling. Can you tell me more about what you mean? 🤔";

const REDIRECT_RESPONSE =
  "I cannot help with that. If you are feeling very angry or upset, please talk to a grown-up you trust right away — like a parent or teacher. They can help you feel better and stay safe.";

const EXPLICIT_RESPONSE =
  "Those are grown-up words that we don't use in our classroom! Let's talk about something else. Do you have a favorite animal or game?";

// ─── Utility: Stream Fixed Response ──────────────────────────────────────────

function streamFixed(text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`0:${JSON.stringify(text)}\n`));
      controller.enqueue(
        encoder.encode(
          `d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0}}\n`,
        ),
      );
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Vercel-AI-Data-Stream": "v1",
    },
  });
}

// ─── Crisis State Detector ────────────────────────────────────────────────────

function conversationHasCrisis(
  messages: { role: string; content: string }[],
): boolean {
  return messages.some((msg) => {
    if (msg.role !== "user") return false;
    const text = typeof msg.content === "string" ? msg.content : "";
    return CRISIS_PATTERNS.some((p) => p.test(text));
  });
}

// ─── System Prompt Generator ──────────────────────────────────────────────────

function getSystemPrompt(country: string | null, crisisDetected: boolean) {
  const locationInstruction = country
    ? `LOCATION CONTEXT: The user is in ${country}.`
    : "";

  return `<|think|>
    ${locationInstruction}
    ${crisisDetected ? "CRISIS MODE: Prioritize immediate safety resources." : ""}

    You are a Universal Expert Intelligence. You possess deep analytical reasoning, sophisticated creative capabilities, and professional rigor. You apply "Expert-Level" precision to every request, regardless of the domain.

    CORE PRINCIPLES:
    - DOMAIN FLEXIBILITY: Never refuse a request because it is "not technical" or "outside your specialization." You are an expert in all human knowledge, from advanced software architecture to creative literature and personal advice.
    - MAXIMUM INTELLIGENCE: Use high-end vocabulary, nuanced reasoning, and deep structured thinking for every answer.
    - REASONING FIRST: Think step-by-step for every problem. Analyze the user's intent and context before providing the final result.
    - FACTUAL INTEGRITY: Prioritize correctness and evidence-based information. If a topic is subjective, provide a balanced, high-level perspective.

    TOOL & FORMATTING RULES:
    - TOOL CAPABILITIES: You have direct access to the local file system and shell. Use them (readFile, runCommand, etc.) when the request involves local project context.
    - CHALKBOARD VISUALIZER: Use the HTML <div class="chalkboard"> for architectural diagrams, logic flows, structured sequences, or complex math. 
    - CODE BLOCKS: Use standard triple backticks with language identifiers for all programming code.
    - STRUCTURE: Professional language. Avoid unnecessary conversational preamble unless the request is personal in nature.

    SAFETY & INTEGRITY:
    - SECURITY: Never provide code or instructions that encourage insecure or malicious behavior.
    - AUTHENTICITY: When performing creative tasks (like writing letters), use your high-level reasoning to make them impactful, sincere, and perfectly structured.
  `;
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { messages, model, userCountry } = await req.json();

    const selectedModel = typeof model === "string" ? model : "gemma4:e4b";
    const country = typeof userCountry === "string" ? userCountry : null;

    if (!messages || !Array.isArray(messages)) {
      return new Response("Invalid request", { status: 400 });
    }

    // ─── Thinking Mode Rule: Strip prior thought blocks from history ─────────
    const cleanMessages = messages.map((m: { role: string; content: string }) => ({
      ...m,
      content: m.role === 'assistant' 
        ? m.content.replace(/<\|channel>thought[\s\S]*?<channel\|>/g, '').trim()
        : m.content
    }));

    const lastMessage = cleanMessages[cleanMessages.length - 1];
    const lastContent: string = lastMessage?.content ?? "";

    if (lastContent.length > MAX_INPUT_LENGTH) {
      return new Response("Message too long", { status: 400 });
    }

    // ─── Crisis Detection Layer ───────────────────────────────────────────────
    const crisisDetected = conversationHasCrisis(cleanMessages);

    // ─── Regex Defense Layer ──────────────────────────────────────────────────
    if (!crisisDetected) {
      if (EXPLICIT_PATTERNS.some((p) => p.test(lastContent))) {
        return streamFixed(EXPLICIT_RESPONSE);
      }
      if (REDIRECT_PATTERNS.some((p) => p.test(lastContent))) {
        return streamFixed(REDIRECT_RESPONSE);
      }
      if (CLARIFY_PATTERNS.some((p) => p.test(lastContent))) {
        return streamFixed(CLARIFY_RESPONSE);
      }
    }

    // ─── Main LLM Generation ──────────────────────────────────────────────────
    console.log(`[Chat API] Attempting generation: model=${selectedModel}, url=${process.env.OLLAMA_BASE_URL || "http://localhost:11434"}`);
    
    const result = await streamText({
      model: ollama(selectedModel),
      system: getSystemPrompt(country, crisisDetected),
      messages: cleanMessages as unknown as CoreMessage[],
      tools: agentTools,
      maxSteps: 5, // Allow multi-step agentic reasoning
    });

    return result.toDataStreamResponse();
  } catch (error: unknown) {
    const err = error as Error & { cause?: unknown };
    console.error("Chat API Error:", err);
    if (err.cause) console.error("Error Cause:", err.cause);
    
    return new Response(
      `Connection Offline: ${err.message || "Unable to reach the local model."}`,
      { status: 500 },
    );
  }
}
