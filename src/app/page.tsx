"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Volume2, VolumeX, RotateCcw, Mic, Keyboard, Radio } from "lucide-react";
import { ArcReactor } from "@/components/jarvis/arc-reactor";
import { SystemPanel } from "@/components/jarvis/system-panel";
import { ChatPanel, type InputMode, type VoiceStatus } from "@/components/jarvis/chat-panel";
import { QUICK_COMMANDS, clipForSpeech, stripWakeWord, type ChatMessage } from "@/lib/jarvis";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/** Encode an AudioBuffer as a 16-bit PCM WAV Blob (mono). */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const length = buffer.length;
  const numChannels = 1;
  const sampleRate = buffer.sampleRate;
  const channelData = buffer.getChannelData(0);

  const wav = new ArrayBuffer(44 + length * 2);
  const view = new DataView(wav);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, length * 2, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return new Blob([wav], { type: "audio/wav" });
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () =>
      resolve(typeof reader.result === "string" ? reader.result.split(",")[1] ?? "" : "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Convert a recorded audio blob to mono WAV and transcribe it via the ASR API. */
async function transcribeBlob(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext();
  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    const wavBlob = audioBufferToWav(decoded);
    const base64 = await blobToBase64(wavBlob);

    const res = await fetch("/api/asr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio: base64 }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Transcription failed");
    return typeof data.text === "string" ? data.text : "";
  } finally {
    audioCtx.close().catch(() => {});
  }
}

export default function JarvisPage() {
  const { toast } = useToast();

  const [mode, setMode] = useState<InputMode>("voice");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [clock, setClock] = useState("--:--:--");
  const [micSupported, setMicSupported] = useState(false);
  const [engaged, setEngaged] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<string | null>(null);
  const sessionTokenRef = useRef(0);
  const vadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const hardCapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceLoopRef = useRef(false);
  const busyRef = useRef(false);
  const voiceRef = useRef(true);
  const modeRef = useRef<InputMode>("voice");
  const engagedRef = useRef(false);
  const sendRef = useRef<(raw: string) => Promise<void>>(async () => {});
  const startVoiceRef = useRef<() => void>(() => {});

  useEffect(() => {
    voiceRef.current = voiceOn;
  }, [voiceOn]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    engagedRef.current = engaged;
  }, [engaged]);

  // Clock
  useEffect(() => {
    const update = () => setClock(new Date().toLocaleTimeString("en-GB", { hour12: false }));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  // Mic support detection
  useEffect(() => {
    const supported =
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== "undefined" &&
      typeof AudioContext !== "undefined";
    setMicSupported(supported);
    if (!supported) setMode("type");
  }, []);

  // Load conversation history
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/jarvis/history");
        const data = await res.json();
        if (data.conversationId) {
          sessionRef.current = data.conversationId;
          setConversationId(data.conversationId);
          setMessages(data.messages ?? []);
        }
      } catch {
        toast({ title: "Failed to load conversation history", variant: "destructive" });
      }
    })();
  }, [toast]);

  // ---------- Speech output ----------

  const speak = useCallback(async (text: string) => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clipForSpeech(text) }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }
      const url = URL.createObjectURL(blob);
      await new Promise<void>((resolve) => {
        const audio = new Audio(url);
        audioRef.current = audio;
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          setSpeaking(false);
          resolve();
        };
        audio.onplay = () => setSpeaking(true);
        audio.onended = finish;
        audio.onpause = finish;
        audio.onerror = finish;
        audio.play().catch(finish);
      });
      URL.revokeObjectURL(url);
    } catch {
      // Voice is a nice-to-have; ignore failures.
    }
  }, []);

  const stopSpeech = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  // ---------- Text pipeline ----------

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || busyRef.current) return;
      busyRef.current = true;
      setInput("");

      setMessages((prev) => [...prev, { id: `local-${Date.now()}`, role: "user", content: text }]);
      setLoading(true);

      try {
        const res = await fetch("/api/jarvis/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: sessionRef.current, message: text }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "JARVIS is unavailable");

        sessionRef.current = data.conversationId;
        setConversationId(data.conversationId);

        const reply = typeof data.reply === "string" ? data.reply : "";
        setMessages((prev) => [...prev, { id: `reply-${Date.now()}`, role: "assistant", content: reply }]);
        setLoading(false);

        if (voiceRef.current && reply) {
          await speak(reply);
        }
      } catch (err) {
        setLoading(false);
        toast({
          title: "Transmission error",
          description: err instanceof Error ? err.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        busyRef.current = false;
      }
    },
    [speak, toast]
  );

  // ---------- Hands-free voice engine ----------

  const teardownMic = useCallback(() => {
    if (vadTimerRef.current) {
      clearInterval(vadTimerRef.current);
      vadTimerRef.current = null;
    }
    if (hardCapTimerRef.current) {
      clearTimeout(hardCapTimerRef.current);
      hardCapTimerRef.current = null;
    }
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        // already inactive
      }
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    micCtxRef.current?.close().catch(() => {});
    micCtxRef.current = null;
    setListening(false);
  }, []);

  const startVoiceSession = useCallback(async () => {
    if (!voiceLoopRef.current || modeRef.current !== "voice") return;

    // Tear down any previous session first so we never hold two mics open.
    teardownMic();

    const token = ++sessionTokenRef.current;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!voiceLoopRef.current || token !== sessionTokenRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = ["audio/webm;codecs=opus", "audio/webm"].find(
        (t) => MediaRecorder.isTypeSupported?.(t)
      );
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      // VAD: watch the amplitude, stop recording after speech + silence.
      const audioCtx = new AudioContext();
      micCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);

      let heardSpeech = false;
      let lastVoiceAt = 0;

      recorder.onstop = async () => {
        if (vadTimerRef.current) {
          clearInterval(vadTimerRef.current);
          vadTimerRef.current = null;
        }
        if (hardCapTimerRef.current) {
          clearTimeout(hardCapTimerRef.current);
          hardCapTimerRef.current = null;
        }
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        audioCtx.close().catch(() => {});
        if (micCtxRef.current === audioCtx) micCtxRef.current = null;
        if (recorderRef.current === recorder) recorderRef.current = null;
        setListening(false);

        // Session superseded or loop stopped: do not process.
        if (!voiceLoopRef.current || token !== sessionTokenRef.current) return;

        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          if (blob.size < 2000) {
            // Too little audio — treat as silence/noise and keep listening.
            startVoiceRef.current();
            return;
          }

          setTranscribing(true);
          const text = await transcribeBlob(blob);
          setTranscribing(false);

          const command = stripWakeWord(text);
          if (!command) {
            startVoiceRef.current();
            return;
          }

          await sendRef.current(command);
          startVoiceRef.current();
        } catch (err) {
          setTranscribing(false);
          toast({
            title: "Voice command failed",
            description: err instanceof Error ? err.message : "Please try again.",
            variant: "destructive",
          });
          startVoiceRef.current();
        }
      };

      recorder.start();
      setListening(true);

      vadTimerRef.current = setInterval(() => {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < samples.length; i++) {
          const v = (samples[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / samples.length);
        if (rms > 0.035) {
          heardSpeech = true;
          lastVoiceAt = Date.now();
        } else if (heardSpeech && Date.now() - lastVoiceAt > 1800) {
          if (recorder.state === "recording") recorder.stop();
        }
      }, 100);

      // Hard cap so a single utterance never runs forever.
      hardCapTimerRef.current = setTimeout(() => {
        if (recorderRef.current === recorder && recorder.state === "recording") {
          recorder.stop();
        }
      }, 30000);
    } catch {
      teardownMic();
      toast({
        title: "Microphone unavailable",
        description: "Grant microphone access to use voice commands.",
        variant: "destructive",
      });
    }
  }, [teardownMic, toast]);

  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  useEffect(() => {
    startVoiceRef.current = () => {
      void startVoiceSession();
    };
  }, [startVoiceSession]);

  useEffect(() => teardownMic, [teardownMic]);

  // ---------- Controls ----------

  const switchMode = (next: InputMode) => {
    if (next === modeRef.current) return;
    if (next === "type") {
      voiceLoopRef.current = false;
      teardownMic();
      stopSpeech();
    }
    setMode(next);
    if (next === "voice" && engagedRef.current) {
      voiceLoopRef.current = true;
      startVoiceRef.current();
    }
  };

  const onVoiceButton = () => {
    if (!micSupported) return;

    if (!engagedRef.current) {
      setEngaged(true);
      engagedRef.current = true;
      voiceLoopRef.current = true;
      startVoiceRef.current();
      return;
    }

    if (speaking) {
      // Barge-in: interrupt JARVIS mid-sentence and resume listening.
      stopSpeech();
      return;
    }

    if (listening) {
      // Manual end-of-utterance: stop and process what was said.
      const recorder = recorderRef.current;
      if (recorder && recorder.state === "recording") recorder.stop();
      return;
    }

    voiceLoopRef.current = true;
    startVoiceRef.current();
  };

  const newSession = async () => {
    try {
      const res = await fetch("/api/jarvis/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: sessionRef.current }),
      });
      const data = await res.json();
      sessionRef.current = data.conversationId;
      setConversationId(data.conversationId);
      setMessages([]);
      stopSpeech();
      toast({ title: "New session initialized", description: "Memory banks cleared, sir." });
    } catch {
      toast({ title: "Could not start a new session", variant: "destructive" });
    }
  };

  // ---------- Derived voice status ----------

  const voiceStatus: VoiceStatus = !micSupported
    ? "no-mic"
    : listening
      ? "listening"
      : transcribing
        ? "transcribing"
        : loading
          ? "processing"
          : speaking
            ? "speaking"
            : engaged
              ? "standby"
              : "disengaged";

  const reactorActive = !loading && !listening && !transcribing;

  return (
    <div className="jarvis-app hud-grid flex min-h-screen flex-col text-cyan-50">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-cyan-500/15 bg-black/60 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="hud-blink h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.9)]" />
            <div>
              <h1 className="font-mono text-lg font-semibold tracking-[0.35em] text-cyan-100">J.A.R.V.I.S.</h1>
              <p className="hidden font-mono text-[10px] tracking-widest text-cyan-100/40 sm:block">
                JUST A RATHER VERY INTELLIGENT SYSTEM
              </p>
            </div>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="hidden items-center gap-2 font-mono text-xs text-cyan-200/80 md:flex">
              <Radio className="h-3.5 w-3.5 text-cyan-400/70" aria-hidden="true" />
              <time suppressHydrationWarning>{clock}</time>
            </div>

            {/* Input mode switch */}
            <div
              role="tablist"
              aria-label="Input mode"
              className="flex items-center rounded-md border border-cyan-500/25 bg-cyan-950/30 p-1"
            >
              <button
                role="tab"
                aria-selected={mode === "voice"}
                onClick={() => switchMode("voice")}
                disabled={!micSupported}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-[11px] tracking-widest transition-colors disabled:opacity-40",
                  mode === "voice"
                    ? "bg-cyan-500/25 text-cyan-100"
                    : "text-cyan-100/50 hover:text-cyan-100/80"
                )}
              >
                <Mic className="h-3.5 w-3.5" aria-hidden="true" />
                VOICE
              </button>
              <button
                role="tab"
                aria-selected={mode === "type"}
                onClick={() => switchMode("type")}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 font-mono text-[11px] tracking-widest transition-colors",
                  mode === "type"
                    ? "bg-cyan-500/25 text-cyan-100"
                    : "text-cyan-100/50 hover:text-cyan-100/80"
                )}
              >
                <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
                TYPE
              </button>
            </div>

            <div className="flex items-center gap-2">
              {voiceOn ? (
                <Volume2 className="h-4 w-4 text-cyan-300" aria-hidden="true" />
              ) : (
                <VolumeX className="h-4 w-4 text-cyan-100/40" aria-hidden="true" />
              )}
              <Switch
                id="voice-toggle"
                checked={voiceOn}
                onCheckedChange={setVoiceOn}
                aria-label="Toggle JARVIS voice output"
              />
              <Label
                htmlFor="voice-toggle"
                className="cursor-pointer font-mono text-[10px] tracking-widest text-cyan-100/60"
              >
                VOICE
              </Label>
            </div>

            <Button
              onClick={() => void newSession()}
              variant="outline"
              size="sm"
              className="gap-2 border-cyan-500/30 bg-cyan-500/10 font-mono text-[11px] tracking-widest text-cyan-200 hover:bg-cyan-500/20 hover:text-cyan-100"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              NEW SESSION
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[340px_1fr]">
        {/* Left rail */}
        <aside className="flex flex-col gap-6">
          <div className="rounded-lg border border-cyan-500/20 bg-black/40 p-5">
            <ArcReactor active={reactorActive} />
            <p className="mt-4 text-center font-mono text-[10px] tracking-[0.3em] text-cyan-300/70">
              {listening
                ? "AWAITING VOCAL INPUT"
                : transcribing
                  ? "TRANSCRIBING VOICE"
                  : loading
                    ? "PROCESSING REQUEST"
                    : speaking
                      ? "RESPONDING ALOUD"
                      : "SYSTEM ONLINE"}
            </p>
          </div>

          <SystemPanel />

          <div className="rounded-lg border border-cyan-500/20 bg-black/40 p-4">
            <h2 className="mb-3 font-mono text-xs tracking-[0.25em] text-cyan-300/80">QUICK COMMANDS</h2>
            <div className="flex flex-wrap gap-2">
              {QUICK_COMMANDS.map((cmd) => (
                <Button
                  key={cmd.label}
                  size="sm"
                  disabled={loading || listening || transcribing}
                  onClick={() => {
                    void send(cmd.prompt).then(() => {
                      if (engagedRef.current && voiceLoopRef.current && modeRef.current === "voice") {
                        startVoiceRef.current();
                      }
                    });
                  }}
                  className="rounded-full border border-amber-500/30 bg-amber-500/10 font-mono text-[11px] text-amber-200/90 hover:bg-amber-500/25 hover:text-amber-100 disabled:opacity-40"
                >
                  {cmd.label}
                </Button>
              ))}
            </div>
          </div>
        </aside>

        {/* Chat */}
        <div className="flex flex-col">
          <ChatPanel
            messages={messages}
            loading={loading}
            input={input}
            setInput={setInput}
            onSend={() => void send(input)}
            mode={mode}
            voiceStatus={voiceStatus}
            onVoiceButton={onVoiceButton}
          />
          <p className="mt-2 px-1 font-mono text-[10px] tracking-wider text-cyan-100/30">
            {mode === "voice"
              ? 'HANDS-FREE: SAY "JARVIS" THEN YOUR COMMAND — OR SWITCH TO TYPE FOR KEYBOARD INPUT'
              : "ENTER TO SEND / SHIFT+ENTER FOR NEW LINE"}
          </p>
        </div>
      </main>

      {/* Sticky footer */}
      <footer className="mt-auto border-t border-cyan-500/15 bg-black/60 py-3 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 sm:px-6 font-mono text-[10px] tracking-widest text-cyan-100/40">
          <span>STARK INDUSTRIES — JARVIS MK II — SESSION {conversationId ? conversationId.slice(0, 8) : "-----"}</span>
          <span suppressHydrationWarning>DUBAI, LOCAL TIME {clock}</span>
        </div>
      </footer>
    </div>
  );
}
