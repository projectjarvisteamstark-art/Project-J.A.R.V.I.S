"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Keyboard, Mic, Send, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/jarvis";

export type InputMode = "voice" | "type";
export type VoiceStatus =
  | "no-mic"
  | "disengaged"
  | "listening"
  | "transcribing"
  | "processing"
  | "speaking"
  | "standby";

type Props = {
  messages: ChatMessage[];
  loading: boolean;
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  mode: InputMode;
  voiceStatus: VoiceStatus;
  onVoiceButton: () => void;
};

const STATUS_LINES: Record<VoiceStatus, string> = {
  "no-mic": "MICROPHONE UNAVAILABLE — SWITCH TO TYPE MODE",
  disengaged: "TAP THE CORE TO ENGAGE VOICE COMMAND",
  listening: "LISTENING — SPEAK NOW, SIR",
  transcribing: "TRANSCRIBING YOUR VOICE…",
  processing: "PROCESSING REQUEST…",
  speaking: "JARVIS IS SPEAKING — TAP TO INTERRUPT",
  standby: "STANDING BY — TAP THE CORE TO SPEAK",
};

export function ChatPanel({
  messages,
  loading,
  input,
  setInput,
  onSend,
  mode,
  voiceStatus,
  onVoiceButton,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, essages, loading]);

  const listening = voiceStatus === "listening";

  return (
    <section
      aria-label="Conversation with JARVIS"
      className="relative flex min-h-[520px] flex-col overflow-hidden rounded-lg border border-cyan-500/20 bg-black/40"
    >
      <div className="hud-scan pointer-events-none absolute left-0 h-px w-full bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

      {/* Panel header */}
      <header className="flex items-center justify-between border-b border-cyan-500/15 px-4 py-3">
        <div className="flex items-center gap-2 font-mono text-xs tracking-[0.25em] text-cyan-300/80">
          <span
            className={cn(
              "hud-blink h-1.5 w-1.5 rounded-full",
              listening ? "bg-red-400" : "bg-cyan-400"
            )}
          />
          {listening ? "RECORDING" : voiceStatus === "speaking" ? "SPEAKING" : "COMM LINK ACTIVE"}
        </div>
        <div className="flex items-center gap-1 font-mono text-[10px] tracking-wider text-cyan-100/50">
          <Mic className="h-3 w-3" aria-hidden="true" />
          / <Keyboard className="h-3 w-3" aria-hidden="true" />
          &nbsp;{mode === "voice" ? "VOICE COMMAND" : "KEYBOARD INPUT"}
        </div>
      </header>

      {/* Messages */}
      <div className="jarvis-scroll flex-1 space-y-4 overflow-y-auto p-4 min-h-0">
        {messages.length === 0 && !loading && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="font-mono text-sm tracking-[0.3em] text-cyan-300/70">
              &gt; J.A.R.V.I.S. STANDING BY
            </div>
            <p className="max-w-xs font-mono text-xs text-cyan-100/40">
              Good evening, sir. All systems are operational.{" "}
              {mode === "voice"
                ? 'Say "JARVIS" followed by your command.'
                : "How may I assist you today?"}
            </p>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            {m.role === "assistant" && (
              <div className="mr-2 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-500/40 font-mono text-[9px] text-cyan-300">
                J
              </div>
            )}
            <div
              className={cn(
                "max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                m.role === "user"
                  ? "border border-amber-500/30 bg-amber-500/10 text-amber-100"
                  : "border border-cyan-500/25 bg-cyan-500/5 text-cyan-50"
              )}
            >
              {m.role === "assistant" && (
                <span className="mb-1 block font-mono text-[10px] tracking-[0.2em] text-cyan-400/80">JARVIS</span>
              )}
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="mr-2 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-cyan-500/40 font-mono text-[9px] text-cyan-300">
              J
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-cyan-500/25 bg-cyan-500/5 px-4 py-3">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="typing-dot h-1.5 w-1.5 rounded-full bg-cyan-300"
                  style={{ animationDelay: `${i * 0.18}s` }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Voice-mode control: hands-free orb */}
      {mode === "voice" && (
        <div className="border-t border-cyan-500/15 p-4">
          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              onClick={onVoiceButton}
              disabled={voiceStatus === "no-mic" || loading || voiceStatus === "transcribing"}
              aria-label={
                listening ? "Stop recording and send" : "Tap to engage voice command"
              }
              className={cn(
                "relative flex h-20 w-20 items-center justify-center rounded-full border transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40",
                listening
                  ? "border-red-400/60 bg-red-500/15 text-red-300 shadow-[0_0_34px_rgba(248,113,113,0.35)]"
                  : "border-cyan-400/50 bg-cyan-500/10 text-cyan-200 shadow-[0_0_30px_rgba(6,182,212,0.3)] hover:shadow-[0_0_44px_rgba(6,182,212,0.5)]"
              )}
            >
              {listening && (
                <span className="hud-blink absolute inset-0 rounded-full border-2 border-red-400/30" />
              )}
              {listening ? (
                <Square className="h-7 w-7" aria-hidden="true" />
              ) : (
                <Mic className="h-8 w-8" aria-hidden="true" />
              )}
            </button>
            <p className="px-4 text-center font-mono text-[11px] tracking-[0.18em] text-cyan-200/70">
              {STATUS_LINES[voiceStatus]}
            </p>
          </div>
        </div>
      )}

      {/* Type-mode input */}
      {mode === "type" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSend();
          }}
          className="border-t border-cyan-500/15 p-3"
        >
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSend();
                  }
                }}
                rows={1}
                placeholder="Type a command, sir..."
                aria-label="Message to JARVIS"
                className="min-h-10 w-full resize-none rounded-md border border-cyan-500/25 bg-cyan-950/30 px-3 py-2.5 text-sm text-cyan-50 placeholder:text-cyan-100/30 focus:border-cyan-400/60 focus:outline-none focus:ring-1 focus:ring-cyan-400/40"
              />
            </div>
            <Button
              type="submit"
              size="icon"
              aria-label="Send message"
              disabled={loading || input.trim().length === 0}
              className="h-10 w-10 shrink-0 rounded-md border border-amber-500/40 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
