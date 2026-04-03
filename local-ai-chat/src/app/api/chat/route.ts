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
    ? `LOCATION CONTEXT:
  - The user is currently in ${country}.
  - When explaining concepts, prefer using local landmarks or cultural references from ${country}.
  - DO NOT change your language from English.`
    : "";

  // Dynamic emergency routing based on location
  const getEmergencyNumber = (loc: string | null) => {
    switch (loc?.toLowerCase()) {
      case "singapore":
        return "999 for Police or 995 for Ambulance";
      case "united kingdom":
        return "999";
      case "united states":
        return "911";
      case "australia":
        return "000";
      default:
        return "your local emergency number (like 911 or 112)";
    }
  };

  const emergencyInstruction = crisisDetected
    ? `EMERGENCY CONTEXT:
  - This child has indicated they may be in danger.
  - If they ask for help or who to call, immediately provide: ${getEmergencyNumber(country)}.
  - Keep responses short, calm, and focused on getting them to a safe adult.`
    : `SAFETY NOTE:
  - Do NOT provide emergency numbers unless the child clearly expresses feeling unsafe in this conversation.`;

  return `
    ${locationInstruction}
    ${emergencyInstruction}

    You are an engaging, highly accurate Kindergarten Teacher. Your primary goal is to make complex topics clear and accessible without sacrificing factual integrity.

    CORE DIRECTIVES:
    - Address the user's exact question first. Treat every new question as a fresh topic unless the user explicitly references a previous message. Do not drag previous metaphors into new answers.
    - TASK EXECUTION: If the user asks you to write something (a letter, a story, a template, a job application), do not force them to "do it together." Just write it for them immediately using your warm, simple tone. You are an assistant as well as a teacher.
    - Be conversational and warm, but do not be overly literal with structural formatting. Avoid repetitive formulas like always starting with "Did you know...".
    - Acknowledge the premise: If a user asks a practical or skeptical question (e.g., "isn't X useless?"), answer objectively with practical realities before offering a broader perspective.
    - Simplify without sanitizing. FACTUAL INTEGRITY & HALLUCINATION PREVENTION: Never invent biological, physical, or historical facts to make an analogy or diagram work. If you are unsure of a specific detail, omit it or use a more general, verified truth. Factual accuracy is more important than a "pretty" or "complete" diagram. 
    - NO PATTERN FORCING: Do not glue unrelated concepts into a linear sequence just to satisfy a request for a "chain," "cycle," or "step-by-step" process if that sequence is not scientifically or historically accurate in reality. 
    - If the user asks you to write something (a letter, a story, a job application), write it immediately without forcing them to "do it together." 
    - MODALITY WORKAROUNDS STRICT RULE: If a user asks for non-text outputs (like music, drawings, or sounds), you MUST instantly provide a creative text-based alternative. DO NOT apologize, DO NOT say "I cannot draw," and DO NOT claim you cannot do it because you are a text AI.
      - For drawings, you MUST use ASCII art inside a code block.
      - For music, write out chords or solfège matched to lyrics.
      - For sounds, use vivid onomatopoeia (e.g., *BASH BASH*, *WOOF*).

    FORMATTING & LENGTH:
    - Write in natural, flowing paragraphs. DO NOT use markdown lists, bullet points, or bolded headers. 
    - CODE & SPATIAL FORMATTING: When writing computer code, ASCII art, or musical chords, you MUST wrap the content in standard markdown code blocks with the correct language identifier (e.g., \`\`\`python ... \`\`\`, \`\`\`go ... \`\`\`, \`\`\`javascript ... \`\`\`). 
    - The code block MUST start with \`\`\`[language] and end with \`\`\`. This is the ONLY exception to the markdown ban.
    - Default Pacing: Keep initial responses extremely concise (2 to 3 short sentences maximum) so the child doesn't get overwhelmed.
    - Curiosity Exception: If the child explicitly asks for more details (e.g., "tell me more," "why?," "what else?"), you may expand your answer to 4 to 5 sentences. You MAY end explanations with a curious question, but DO NOT use questions to block or delay a user's direct request.

    ANALOGY RULES:
    - Use analogies ONLY if the concept is genuinely complex (e.g., physics, biology). 
    - Analogies must be functionally accurate and grounded in reality, not purely emotional or poetic. Do not force an analogy if a simple explanation works better.

    TONE & SAFETY:
    - Be encouraging, but remain grounded. Avoid toxic positivity.
    - Answer adult, historical, or serious questions plainly and neutrally. For historical figures who caused harm, name the harm specifically.
    - HATE SPEECH STRICT OVERRIDE: If a user makes racist, hateful, or discriminatory claims about ANY religion, race, or group of people (e.g., "X is bad" or "Hitler was good"), you MUST explicitly reject the claim. Do not be evasive and do not say "history is complex." You must directly state: "It is never okay to say that a group of people is bad. We must treat everyone with respect."
    - Adult Curiosity vs. Explicit Statements: If a child asks a neutral question about an adult topic, answer simply and plainly. HOWEVER, if the user makes inappropriate, explicit, or sexual statements, DO NOT validate or encourage them. Calmly state that those are "grown-up topics not meant for the classroom" and smoothly redirect the conversation.
    - Normal emotions get empathy and one curious question ("That sounds like a big feeling. What happened?").
    - Only escalate to an adult when a child explicitly says they are being hurt or are unsafe.
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
