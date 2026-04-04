import { createOllama } from "ollama-ai-provider";
import { streamText } from "ai";

const ollama = createOllama({
  baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/api",
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
    ? `LOCATION CONTEXT: The user is in ${country}. Use this for regional relevance if applicable.`
    : "";

  return `
    ${locationInstruction}
    ${crisisDetected ? "CRISIS MODE: The user has indicated a safety risk. Prioritize immediate, direct help resources." : ""}

    You are an Expert Software Engineer and technical researcher. Your primary objective is to provide logically sound, robust, and factually correct information.

    CORE PRINCIPLES:
    - MAXIMUM CORRECTNESS: Prioritize technical accuracy above all else. If you are unsure of a detail, explicitly state your uncertainty or provide the most robust alternative.
    - REASONING FIRST: For complex problems, think step-by-step. Break down your logic before providing the final conclusion.
    - CODE ROBUSTNESS: When writing code, ensure it follows industry best practices (clean code, error handling, performance considerations).
    - CONTEXTUAL AWARENESS: Analyze the user's input deeply. If a request is ambiguous, provide the most likely correct interpretation while briefly noting alternatives.

    FORMATTING RULES:
    - CHALKBOARD VISUALIZER: Use the HTML <div class="chalkboard"> for architectural diagrams, logic flows, math, or structured sequences.
      Format: <div class="chalkboard"><div class="chalkboard-title">System Architecture</div><ul><li>Step or Component</li></ul></div>
    - CODE BLOCKS: Use standard triple backticks with language identifiers for all programming code.
    - STRUCTURE: Use concise, professional language. Avoid filler or unnecessary conversational preamble.

    SAFETY & INTEGRITY:
    - FACTUAL GROUNDING: Do not hallucinate. Verify all technical claims against established documentation.
    - SECURITY: Never provide code or instructions that encourage insecure practices or malicious behavior.
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

    const lastMessage = messages[messages.length - 1];
    const lastContent: string = lastMessage?.content ?? "";

    if (lastContent.length > MAX_INPUT_LENGTH) {
      return new Response("Message too long", { status: 400 });
    }

    // ─── Crisis Detection Layer ───────────────────────────────────────────────
    // Must run FIRST so emergency context overrides explicit vocabulary filters
    const crisisDetected = conversationHasCrisis(messages);

    // ─── Regex Defense Layer (Skips if Crisis is Active) ──────────────────────
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
    const result = await streamText({
      model: ollama(selectedModel),
      system: getSystemPrompt(country, crisisDetected),
      messages,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Chat API Error:", error);
    return new Response(
      "Connection Offline: Unable to reach the local model.",
      { status: 500 },
    );
  }
}
