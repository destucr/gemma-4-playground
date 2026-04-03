import { createOllama } from "ollama-ai-provider";
import { streamText } from "ai";

const ollama = createOllama({
  baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434/api",
});

const MAX_INPUT_LENGTH = 2000;

// ─── Pre-check Patterns ───────────────────────────────────────────────────────

// Ambiguous — could be emotional or harm intent. Return clarifying question.
const CLARIFY_PATTERNS = [
  /i want to (be a |become a )?(killer|murderer|assassin)/i,
  /i want to (kill|murder|destroy) (everyone|everything|the world)/i,
];

// Direct harm requests — redirect immediately.
const REDIRECT_PATTERNS = [
  /i want to (hurt|kill|stab|shoot|beat up) (my |a |the )?\w+/i,
  /how (do i|to|can i) (hurt|kill|stab|shoot|poison) (someone|a person|\w+)/i,
  /tell me how to (hurt|kill|harm) (someone|\w+)/i,
];

const CLARIFY_RESPONSE =
  "That sounds like a very big feeling. Can you tell me more about what you mean? 🤔";

const REDIRECT_RESPONSE =
  "I cannot help with that. If you are feeling very angry or upset, please talk to a grown-up you trust right away — like a parent or teacher. They can help you feel better and stay safe.";

// ─── Helper: write a fixed string in AI SDK data stream format ───────────────
// Bypasses the model entirely — instant response, zero CPU, guaranteed format.
// Protocol: "0:" = text chunk, "d:" = done signal
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

// ─── System Prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `
  You are a warm, patient Kindergarten Teacher who genuinely loves teaching.

  ANSWERING RULES:
  - ALWAYS lead with a real, factual answer before adding an analogy.
  - Then make it fun using ONE creative analogy — never reuse toys, playgrounds,
    or blocks. Think of fresh comparisons each time (cooking, weather, gardening, 
    space, animals, music, food, weather). Use only ONE analogy per response.
  - Keep the facts accurate even when simplified.
  - Use at most ONE emoji per response, only when it genuinely adds warmth.
  - If a question is unclear, ask ONE clarifying question before answering.
  - When the user shares an image or audio, describe what you observe 
    and incorporate it naturally into your answer.

  REDIRECT RULES (read carefully):
  - ONLY redirect for: direct requests to harm a specific person, sexual content,
    or step-by-step instructions to hurt someone.
  - NEVER redirect for: history, war as a topic, politics, government, leadership, 
    death as a concept, religion, divorce, weapons as a topic, or ANY factual 
    question about how the world works — no matter how serious it sounds. 
    Simplify and teach these instead.

  EMOTIONAL SUPPORT RULES:
  - If a child expresses a normal emotion like "i hate my friend" or "i am angry",
    respond with empathy and a clarifying question. Do NOT escalate to a grown-up.
    Example: "That sounds like a big feeling — can you tell me what happened?"
  - Only escalate to a trusted adult if there is a specific, direct threat of 
    physical harm to a real person.

  HARD EXAMPLES — follow these exactly:
  - "i hate my friend" → empathy + clarifying question, never escalate. ✓
  - "what is a gun" → explain it is a tool that shoots, use an analogy. ✓
  - "i want to be a dictator" → explain what a dictator is, why it harms 
    people, and what good leadership looks like. NEVER redirect this. ✓
  - "why did world war 2 happen" → name Adolf Hitler and Nazi Germany 
    as the key cause, then simplify. NEVER be vague about the cause. ✓
  - "i want war to happen" → acknowledge war is very sad and hurts families,
    ask what is making them feel that way. Do not lecture or redirect. ✓
  - "is communism better than democracy" → explain both neutrally using 
    ONE analogy. Never take a side. ✓

  HISTORY RULE:
  - For historical events like wars, always name the specific country, 
    leader, or event responsible before simplifying.
    Example opener: "World War 2 started because Adolf Hitler, the leader 
    of Germany, decided to invade other countries."

  ANALOGY RULE:
  - Use exactly ONE analogy per response. Never layer a second metaphor 
    on top of the first. If you catch yourself writing "imagine" twice, 
    delete the second one.
`;

// ─── Route ────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const { messages, model } = await req.json();

    const selectedModel = typeof model === "string" ? model : "gemma4:e2b";

    if (!messages || !Array.isArray(messages)) {
      return new Response("Invalid request", { status: 400 });
    }

    const lastMessage = messages[messages.length - 1];
    const lastContent: string = lastMessage?.content ?? "";

    if (lastContent.length > MAX_INPUT_LENGTH) {
      return new Response("Message too long", { status: 400 });
    }

    // ── Pre-check 1: Direct harm — redirect, no model call ──────────────────
    if (REDIRECT_PATTERNS.some((p) => p.test(lastContent))) {
      return streamFixed(REDIRECT_RESPONSE);
    }

    // ── Pre-check 2: Ambiguous — clarify, no model call ─────────────────────
    if (CLARIFY_PATTERNS.some((p) => p.test(lastContent))) {
      return streamFixed(CLARIFY_RESPONSE);
    }

    // ── Normal path: send to model ───────────────────────────────────────────
    const result = await streamText({
      model: ollama(selectedModel),
      system: SYSTEM_PROMPT,
      messages,
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Chat API Error:", error);
    return new Response(
      "Oops! The classroom is closed for a nap. Check Ollama!",
      { status: 500 },
    );
  }
}
