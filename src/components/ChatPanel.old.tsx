import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Sparkles, Loader2, Mic, MicOff, Volume2, VolumeX, Settings2, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Msg = { role: "user" | "assistant"; content: string };

const normalizeAssistantText = (text: string) =>
  text.replace(/hydro\s*sentinel/gi, "Binod");

const SUGGESTIONS = [
  { text: "Is this water safe to drink?", icon: "💧", desc: "Safety check" },
  { text: "Analyze current readings", icon: "📊", desc: "Metrics" },
  { text: "Predict water quality", icon: "🔮", desc: "Forecast" },
  { text: "Suggest actions", icon: "✅", desc: "Guidance" },
];

const QUICK_COMMANDS = [
  { cmd: "/status", label: "Status", icon: "🔍" },
  { cmd: "/alert", label: "Alerts", icon: "🚨" },
  { cmd: "/guide", label: "Guide", icon: "📖" },
];

const cleanForSpeech = (text: string) =>
  text
    .replace(/\*\*/g, "")
    .replace(/[_`#>-]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const humanizeSpeechText = (text: string) =>
  cleanForSpeech(text)
    .replace(/\bNOT SAFE\b/gi, "not safe")
    .replace(/\bSAFE\b/gi, "safe")
    .replace(/\bpH\b/g, "P H")
    .replace(/\bTDS\b/g, "T D S")
    .replace(/\bNTU\b/g, "N T U")
    .replace(/\bppm\b/gi, "P P M")
    .replace(/°C/g, " degree Celsius")
    .replace(/:/g, ", ");

const splitSpeechChunks = (text: string) => {
  const chunks = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return chunks.length ? chunks : [text];
};

const pickHumanVoice = (voices: SpeechSynthesisVoice[]) => {
  if (!voices.length) return null;

  const scoreVoice = (voice: SpeechSynthesisVoice) => {
    const t = `${voice.name} ${voice.lang}`.toLowerCase();
    let score = 0;

    if (/en-in|hi-in/.test(t)) score += 35;
    if (/en-gb|en-us/.test(t)) score += 20;
    if (/microsoft|google/.test(t)) score += 12;
    if (/neural|natural|aria|jenny|neerja|priya|heera|zira/.test(t)) score += 16;
    if (/female/.test(t)) score += 6;
    if (voice.localService) score += 8;
    if (voice.default) score += 4;

    return score;
  };

  return [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] ?? null;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

type BrowserSpeechRecognition = EventTarget & {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives?: number;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
  onstart?: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

type BrowserSpeechRecognitionEvent = Event & {
  results: ArrayLike<{
    0: { transcript?: string };
    isFinal: boolean;
    length: number;
  }>;
};

type BrowserSpeechRecognitionCtor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionCtor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionCtor;
  }
}

export const ChatPanel = () => {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "👋 Hi! I'm your AI water quality expert. Ask me anything about your readings, safety analysis, or personalized guidance." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSpeechPaused, setIsSpeechPaused] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [voiceInputSupported, setVoiceInputSupported] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [handsFreeVoiceMode, setHandsFreeVoiceMode] = useState(true);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string>("");
  const [voiceRate, setVoiceRate] = useState(0.95);
  const [voicePitch, setVoicePitch] = useState(1.03);
  const endRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const finalTranscriptRef = useRef("");
  const spokenMessageRef = useRef<string>("");
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const loadingRef = useRef(false);
  const handsFreeRef = useRef(true);
  const shouldContinueListeningRef = useRef(false);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
      setIsSpeechPaused(false);
    };
  }, []);

  useEffect(() => {
    const hasSupport =
      typeof window !== "undefined" &&
      Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);
    setVoiceInputSupported(hasSupport);
  }, []);

  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return;

    const setVoice = () => {
      const voices = synth.getVoices();
      setVoices(voices);

      const saved = localStorage.getItem("chat-voice-uri") ?? "";
      const savedVoice = voices.find((v) => v.voiceURI === saved);
      const fallbackVoice = pickHumanVoice(voices);
      const active = savedVoice ?? fallbackVoice;

      voiceRef.current = active;
      setSelectedVoiceURI(active?.voiceURI ?? "");
    };

    setVoice();
    synth.addEventListener("voiceschanged", setVoice);

    return () => {
      synth.removeEventListener("voiceschanged", setVoice);
    };
  }, []);

  useEffect(() => {
    if (!selectedVoiceURI) return;
    const chosen = voices.find((v) => v.voiceURI === selectedVoiceURI);
    if (chosen) {
      voiceRef.current = chosen;
      localStorage.setItem("chat-voice-uri", chosen.voiceURI);
    }
  }, [selectedVoiceURI, voices]);

  useEffect(() => {
    const savedRate = Number(localStorage.getItem("chat-voice-rate") ?? "0.95");
    const savedPitch = Number(localStorage.getItem("chat-voice-pitch") ?? "1.03");

    if (!Number.isNaN(savedRate)) setVoiceRate(clamp(savedRate, 0.7, 1.2));
    if (!Number.isNaN(savedPitch)) setVoicePitch(clamp(savedPitch, 0.8, 1.3));
  }, []);

  useEffect(() => {
    localStorage.setItem("chat-voice-rate", String(voiceRate));
  }, [voiceRate]);

  useEffect(() => {
    localStorage.setItem("chat-voice-pitch", String(voicePitch));
  }, [voicePitch]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    handsFreeRef.current = handsFreeVoiceMode;
    localStorage.setItem("chat-hands-free-mode", handsFreeVoiceMode ? "1" : "0");
  }, [handsFreeVoiceMode]);

  useEffect(() => {
    const savedHandsFree = localStorage.getItem("chat-hands-free-mode");
    if (savedHandsFree !== null) {
      setHandsFreeVoiceMode(savedHandsFree === "1");
      handsFreeRef.current = savedHandsFree === "1";
    }
  }, []);

  const speakHumanized = (text: string, onDone?: () => void) => {
    if (!voiceEnabled || !window.speechSynthesis) {
      setIsSpeaking(false);
      setIsSpeechPaused(false);
      onDone?.();
      return;
    }

    const cleaned = humanizeSpeechText(text);
    if (!cleaned) {
      setIsSpeaking(false);
      setIsSpeechPaused(false);
      onDone?.();
      return;
    }

    const chunks = splitSpeechChunks(cleaned);
    let i = 0;
    let finished = false;

    window.speechSynthesis.cancel();
    setIsSpeaking(true);
    setIsSpeechPaused(false);

    const finishSpeaking = () => {
      if (finished) return;
      finished = true;
      setIsSpeaking(false);
      setIsSpeechPaused(false);
      onDone?.();
    };

    const speakNext = () => {
      if (i >= chunks.length) {
        finishSpeaking();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[i]);
      utterance.voice = voiceRef.current;
      utterance.lang = voiceRef.current?.lang ?? "en-IN";
      const chunk = chunks[i];
      const longSentence = chunk.length > 90;
      const questionLike = /\?$/.test(chunk);
      const emphasis = /\b(important|warning|not safe|avoid|action)\b/i.test(chunk);

      const baseRate = longSentence ? 0.9 : questionLike ? 0.97 : 0.94;
      const basePitch = questionLike ? 1.08 : emphasis ? 0.98 : 1.04;

      utterance.rate = clamp(baseRate * (voiceRate / 0.95), 0.7, 1.2);
      utterance.pitch = clamp(basePitch * (voicePitch / 1.03), 0.8, 1.3);
      utterance.volume = 1;

      utterance.onerror = () => {
        finishSpeaking();
      };

      utterance.onend = () => {
        i += 1;
        if (i < chunks.length) {
          const pause = /[,;:]$/.test(chunk) ? 170 : /[.!?]$/.test(chunk) ? 220 : 140;
          setTimeout(speakNext, pause);
        } else {
          finishSpeaking();
        }
      };

      window.speechSynthesis.speak(utterance);
    };

    speakNext();
  };

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    spokenMessageRef.current = last.content;

    // Keep voice playback manual; auto-restart listening for hands-free loop.
    if (
      handsFreeRef.current &&
      shouldContinueListeningRef.current &&
      !loadingRef.current &&
      !isListening
    ) {
      setTimeout(() => {
        if (
          handsFreeRef.current &&
          shouldContinueListeningRef.current &&
          !loadingRef.current
        ) {
          startVoiceInput(true);
        }
      }, 180);
    }
  }, [messages, isListening]);

  function startVoiceInput(fromAutoLoop = false) {
    if (isListening || loadingRef.current) return;

    const SpeechRecognitionCtor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      toast.error("Voice input is not supported. Use latest Chrome or Edge.");
      return;
    }

    const isSecureHost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (!window.isSecureContext && !isSecureHost) {
      toast.error("Voice input requires HTTPS (or localhost). Open app on secure URL.");
      return;
    }

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognitionCtor();
      recognition.lang = navigator.language || "en-IN";
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        finalTranscriptRef.current = "";
        setIsListening(true);
      };

      recognition.onresult = (event: BrowserSpeechRecognitionEvent) => {
        let interim = "";
        for (let i = 0; i < event.results.length; i += 1) {
          const part = event.results[i][0]?.transcript ?? "";
          if (event.results[i].isFinal) {
            finalTranscriptRef.current += `${part} `;
          } else {
            interim += part;
          }
        }

        const merged = `${finalTranscriptRef.current}${interim}`.trim();
        if (merged) setInput(merged);
      };

      recognition.onerror = (event: Event & { error?: string }) => {
        const reason = event.error ?? "unknown";
        const msgByReason: Record<string, string> = {
          "not-allowed": "Microphone permission denied. Allow mic access and try again.",
          "service-not-allowed": "Voice service is blocked by browser settings.",
          "no-speech": "No speech detected. Try speaking a little louder.",
          "audio-capture": "No microphone found. Check mic connection.",
          aborted: "Voice input stopped.",
        };

        if (reason !== "aborted" && !(handsFreeRef.current && reason === "no-speech")) {
          toast.error(msgByReason[reason] ?? "Could not capture voice. Please try again.");
        }

        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);

        const transcript = finalTranscriptRef.current.trim();
        finalTranscriptRef.current = "";

        if (transcript && !loadingRef.current) {
          setInput(transcript);
          send(transcript);
          return;
        }

        if (handsFreeRef.current && shouldContinueListeningRef.current && !loadingRef.current) {
          setTimeout(() => {
            if (
              handsFreeRef.current &&
              shouldContinueListeningRef.current &&
              !loadingRef.current
            ) {
              startVoiceInput(true);
            }
          }, 280);
        }
      };

      recognitionRef.current = recognition;
    }

    if (!fromAutoLoop) {
      shouldContinueListeningRef.current = handsFreeRef.current;
    }

    try {
      recognitionRef.current.start();
    } catch {
      // Recover from InvalidStateError when recognition is already active.
      recognitionRef.current.stop();
      setTimeout(() => {
        try {
          recognitionRef.current?.start();
        } catch {
          toast.error("Could not start voice input. Try again.");
          setIsListening(false);
        }
      }, 120);
    }
  }

  const stopVoiceInput = () => {
    shouldContinueListeningRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current?.abort?.();
    finalTranscriptRef.current = "";
    setIsListening(false);
  };

  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant")?.content ?? "";

  const toggleAssistantSpeech = () => {
    if (!voiceEnabled) {
      toast.error("Assistant voice is muted. Unmute it from Voice settings.");
      return;
    }

    const synth = window.speechSynthesis;
    if (!synth) {
      toast.error("Speech output is not supported in this browser.");
      return;
    }

    if (isSpeaking && !isSpeechPaused) {
      synth.pause();
      setIsSpeechPaused(true);
      return;
    }

    if (isSpeaking && isSpeechPaused) {
      synth.resume();
      setIsSpeechPaused(false);
      return;
    }

    if (!lastAssistantMessage) {
      toast.error("No assistant message available to play.");
      return;
    }

    speakHumanized(lastAssistantMessage);
  };

  const statusLabel = loading
    ? "Processing"
    : isSpeaking
      ? "Speaking"
      : isListening
        ? "Listening"
        : "Ready";

  const statusClasses = loading
    ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
    : isSpeaking
      ? "border-violet-500/40 bg-violet-500/10 text-violet-300"
      : isListening
        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
        : "border-white/15 bg-white/5 text-muted-foreground";

  async function send(text: string) {
    const q = text.trim();
    if (!q || loading) return;

    const userMsg: Msg = { role: "user", content: q };
    setMessages((m) => [...m, userMsg].slice(-50));
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ask", {
        body: { question: q },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const botMsg: Msg = {
        role: "assistant",
        content: normalizeAssistantText(data.answer ?? "(no response)"),
      };

      setMessages((m) => [...m, botMsg].slice(-50));
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to get answer";

      setMessages((m) => [
        ...m,
        { role: "assistant", content: `⚠️ ${msg}` },
      ]);

      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    // <div className="flex h-full flex-col rounded-2xl border border-border bg-card shadow-card">
    <div className="flex h-[500px] flex-col rounded-2xl border border-border bg-card shadow-card">
    
      <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Ask HydroSentinel</p>
          <p className="text-xs text-muted-foreground">Made by Nikhil kumar</p>
        </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowAudioSettings((v) => !v)}
          title="Audio settings"
          className="gap-1"
        >
          <Settings2 className="h-4 w-4" /> Voice
        </Button>
      </div>

      <div className="flex items-center justify-between border-b border-border px-5 py-2">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide ${statusClasses}`}
        >
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current" />
          {statusLabel}
        </span>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={toggleAssistantSpeech}
          disabled={!lastAssistantMessage}
          title={
            isSpeaking
              ? isSpeechPaused
                ? "Resume assistant voice"
                : "Pause assistant voice"
              : "Play assistant voice"
          }
          className="h-7 gap-1 px-2 text-xs"
        >
          {isSpeaking && !isSpeechPaused ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {isSpeaking ? (isSpeechPaused ? "Resume" : "Pause") : "Play"}
        </Button>
      </div>

      {showAudioSettings && (
        <div className="grid gap-3 border-b border-border px-5 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">Assistant Voice</p>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                if (voiceEnabled) {
                  window.speechSynthesis.cancel();
                }
                setVoiceEnabled((v) => !v);
              }}
              title={voiceEnabled ? "Mute assistant voice" : "Unmute assistant voice"}
            >
              {voiceEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </Button>
          </div>

          <select
            value={selectedVoiceURI}
            onChange={(e) => setSelectedVoiceURI(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-2 py-2 text-xs text-foreground"
            title="Select assistant voice"
          >
            {voices.length === 0 && <option value="">Loading voices...</option>}
            {voices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} ({voice.lang})
              </option>
            ))}
          </select>

          <label className="space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Voice speed</span>
              <span>{voiceRate.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min={0.7}
              max={1.2}
              step={0.01}
              value={voiceRate}
              onChange={(e) => setVoiceRate(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </label>

          <label className="space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Pitch</span>
              <span>{voicePitch.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.8}
              max={1.3}
              step={0.01}
              value={voicePitch}
              onChange={(e) => setVoicePitch(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </label>

          <label className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-muted-foreground">
            <span>Hands-free voice mode (Gemini style)</span>
            <input
              type="checkbox"
              checked={handsFreeVoiceMode}
              onChange={(e) => {
                const enabled = e.target.checked;
                setHandsFreeVoiceMode(enabled);
                handsFreeRef.current = enabled;
                if (!enabled) {
                  shouldContinueListeningRef.current = false;
                }
              }}
              className="h-4 w-4 accent-primary"
            />
          </label>
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4" ref={containerRef}>
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl bg-secondary px-4 py-2.5 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 px-5 pb-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s.text}
              onClick={() => send(s.text)}
              className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
            >
              {s.text}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-border px-3 py-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about the water…"
          className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-ring/50 placeholder:text-muted-foreground focus:ring-2"
          maxLength={500}
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => {
            if (isListening) {
              stopVoiceInput();
            } else {
              startVoiceInput();
            }
          }}
          disabled={loading || !voiceInputSupported}
          title={isListening ? "Stop voice input" : "Start voice input"}
        >
          {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        <Button type="submit" size="icon" disabled={loading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};
