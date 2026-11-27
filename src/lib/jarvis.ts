export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt?: string;
};

export const QUICK_COMMANDS: { label: string; prompt: string }[] = [
  { label: "Full diagnostic", prompt: "Run a full system diagnostic and give me a status report." },
  { label: "Suit status", prompt: "Give me a status report on the Mark III suit." },
  { label: "Schedule", prompt: "What should my schedule look like today? Plan it out for me." },
  { label: "Witty remark", prompt: "Tell me something witty, JARVIS. You know my taste." },
  { label: "Tech briefing", prompt: "Brief me on the most important trends in AI right now." },
  { label: "Workshop ideas", prompt: "I want to build something new in the workshop tonight. Give me ideas." },
];

/** Truncate text for TTS input (max 1024 chars per API limit). */
export function clipForSpeech(text: string, max = 950): string {
  const clean = text.replace(/[#*_`~>|]/g, "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("!"), cut.lastIndexOf("?"));
  return lastStop > 200 ? cut.slice(0, lastStop + 1) : cut;
}

/**
 * Strip a leading wake word ("JARVIS", "Hey Jarvis", "Okay Jarvis", ...)
 * from a voice transcription, returning just the command.
 */
export function stripWakeWord(text: string): string {
  return text
    .trim()
    .replace(/^(hey|ok|okay|hi|hello|yo)?\s*jarvis[\s,;:.!-]*/i, "")
    .trim();
}
