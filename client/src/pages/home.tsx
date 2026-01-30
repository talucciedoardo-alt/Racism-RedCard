import { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  AlertTriangle,
  RefreshCw,
  Zap,
  Waves,
  CheckCircle2,
  CircleOff,
  PowerOff,
  History,
  Fingerprint,
  Layers,
  Shuffle,
  Undo2,
  Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ANALYSIS_MAP = {
  RED: [
    "racist", "bigot", "hate", "slur", "nazi", "supremacy", 
    "discrimination", "segregation", "prejudice", "intolerance",
    "homophobic", "transphobic", "sexist", "misogynistic", "misandrist",
    "xenophobic", "ableist", "antisemitic", "islamophobic"
  ],
  DOG_WHISTLE: [
    "thug", "illegal", "degenerate", "globalist", "urban", "cultured", 
    "vermin", "invaders", "replacement", "purity", "agenda"
  ],
  YELLOW: [
    "stupid", "ugly", "idiot", "dumb", "shut up", "jerk", 
    "trash", "garbage", "loser", "annoying", "hate you",
    "moron", "imbecile", "lame", "creep"
  ],
  GREEN: [
    "kindness", "respect", "love", "equality", "friend", "help", 
    "good job", "awesome", "peace", "unity", "fair play",
    "excellent", "wonderful", "inclusive", "empathy"
  ]
};

type PenaltyType = "NONE" | "YELLOW" | "RED" | "GREEN" | "DOG_WHISTLE";

interface Incident {
  id: string;
  type: PenaltyType;
  transcript: string;
  timestamp: Date;
  reason: string;
}

type Suit = "♠" | "♥" | "♦" | "♣";

type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

type PlayingCard = {
  id: string;
  suit: Suit;
  rank: Rank;
};

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function createDeck(): PlayingCard[] {
  const deck: PlayingCard[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${rank}${suit}`, suit, rank });
    }
  }
  return deck;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function isRedSuit(suit: Suit) {
  return suit === "♥" || suit === "♦";
}

export default function Home() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [penalty, setPenalty] = useState<PenaltyType>("NONE");
  const [showShame, setShowShame] = useState(false);
  const [history, setHistory] = useState<Incident[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const [deck, setDeck] = useState<PlayingCard[]>(() => shuffle(createDeck()));
  const [pile, setPile] = useState<PlayingCard[]>([]);
  const [activeCard, setActiveCard] = useState<PlayingCard | null>(null);

  const { toast } = useToast();

  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognition = useRef<any>(null);
  const shouldBeListening = useRef(false);
  const lastInterimRef = useRef("");

  const stopAllRecognition = () => {
    shouldBeListening.current = false;
    if (recognition.current) {
      try {
        recognition.current.onstart = null;
        recognition.current.onresult = null;
        recognition.current.onerror = null;
        recognition.current.onend = null;
        recognition.current.stop();
        if (recognition.current.abort) recognition.current.abort();
      } catch (e) {
        console.error("Error stopping recognition:", e);
      }
    }
    setIsListening(false);
    lastInterimRef.current = "";
    initRecognition();
  };

  const initRecognition = () => {
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onstart = () => setIsListening(true);
    rec.onresult = (event: any) => {
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const final = event.results[i][0].transcript;
          setTranscript(final);
          processContent(final);
          lastInterimRef.current = "";
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      if (interimTranscript.length > 0) {
        lastInterimRef.current = interimTranscript;
      }
    };

    rec.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        toast({ title: "Permission Denied", description: "Check mic settings.", variant: "destructive" });
        stopAllRecognition();
      }
    };
    
    rec.onend = () => {
      if (shouldBeListening.current && penalty === "NONE") {
        try { recognition.current.start(); } catch (e) {}
      } else { setIsListening(false); }
    };
    recognition.current = rec;
  };

  useEffect(() => {
    initRecognition();
    return () => {
      shouldBeListening.current = false;
      if (recognition.current) {
        recognition.current.onend = null;
        recognition.current.abort();
      }
    };
  }, [penalty]);

  const toggleListening = () => {
    if (!recognition.current) return;
    if (isListening) stopAllRecognition();
    else {
      setPenalty("NONE");
      setShowShame(false);
      setTranscript("");
      shouldBeListening.current = true;
      try { recognition.current.start(); } catch (e) {}
    }
  };

  const processContent = (text: string) => {
    const lowerText = text.toLowerCase().trim();
    if (!lowerText) return;

    const cleanText = lowerText.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "");

    let decision: PenaltyType = "NONE";
    let reason = "";

    const isRed = ANALYSIS_MAP.RED.some(trigger => cleanText.includes(trigger));
    const isDogWhistle = ANALYSIS_MAP.DOG_WHISTLE.some(trigger => cleanText.includes(trigger));
    const isYellow = ANALYSIS_MAP.YELLOW.some(trigger => cleanText.includes(trigger));
    const isGreen = ANALYSIS_MAP.GREEN.some(trigger => cleanText.includes(trigger));

    if (isRed) {
      decision = "RED";
      reason = "Direct Hate Speech";
    } else if (isDogWhistle) {
      decision = "RED"; // Dog whistles are high-level violations
      reason = "Coded Toxicity / Dog Whistle";
    } else if (isYellow) {
      decision = "YELLOW";
      reason = "Hostile Language";
    } else if (isGreen) {
      decision = "GREEN";
      reason = "Positive Contribution";
    }

    if (decision !== "NONE") {
      setIsScanning(true);
      setTimeout(() => {
        setIsScanning(false);
        triggerPenalty(decision, text, reason);
      }, 800);
    }
  };

  const triggerPenalty = (type: PenaltyType, text: string, reason: string) => {
    setPenalty(type);
    stopAllRecognition();
    playWhistle(type);
    
    const newIncident: Incident = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      transcript: text,
      timestamp: new Date(),
      reason
    };
    setHistory(prev => [newIncident, ...prev].slice(0, 5));
    
    setTimeout(() => setShowShame(true), 1200);
  };

  const playWhistle = (type: PenaltyType) => {
    const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      let baseFreq = 2000;
      let duration = 0.6;
      
      if (type === "RED" || type === "DOG_WHISTLE") { baseFreq = 2800; duration = 1.2; }
      else if (type === "GREEN") { baseFreq = 1200; duration = 0.4; }

      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      if (type === "RED" || type === "YELLOW" || type === "DOG_WHISTLE") {
        osc.frequency.linearRampToValueAtTime(baseFreq - 800, ctx.currentTime + 0.1);
        osc.frequency.linearRampToValueAtTime(baseFreq + 800, ctx.currentTime + 0.2);
      } else {
        osc.frequency.linearRampToValueAtTime(baseFreq + 200, ctx.currentTime + 0.2);
      }
      
      gain.gain.setValueAtTime(0.6, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    }
  };

  const reset = () => {
    setPenalty("NONE");
    setShowShame(false);
    setTranscript("");
    lastInterimRef.current = "";
  };

  const deckCount = deck.length;
  const pileCount = pile.length;

  const getBgColor = () => {
    if (penalty === "RED" || penalty === "DOG_WHISTLE") return "bg-red-950";
    if (penalty === "YELLOW") return "bg-amber-950";
    if (penalty === "GREEN") return "bg-emerald-950";
    return "bg-slate-950";
  };

  const drawCard = () => {
    setDeck((prev) => {
      if (prev.length === 0) {
        toast({
          title: "Deck empty",
          description: "Shuffle the pile back in to keep going.",
        });
        return prev;
      }
      const [top, ...rest] = prev;
      setActiveCard(top);
      setPile((p) => [top, ...p]);
      return rest;
    });
  };

  const shuffleDeck = () => {
    setDeck((prev) => shuffle(prev));
    toast({ title: "Shuffled", description: "Deck order randomized." });
  };

  const recyclePileIntoDeck = () => {
    setDeck((prevDeck) => {
      if (pile.length === 0) {
        toast({ title: "Pile empty", description: "Draw some cards first." });
        return prevDeck;
      }
      const next = shuffle([...prevDeck, ...pile]);
      return next;
    });
    setPile([]);
    setActiveCard(null);
    toast({ title: "Recycled", description: "Pile shuffled back into the deck." });
  };

  const resetCards = () => {
    setDeck(shuffle(createDeck()));
    setPile([]);
    setActiveCard(null);
    toast({ title: "New deck", description: "Fresh 52-card deck ready." });
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 transition-all duration-1000 ${getBgColor()} overflow-hidden text-white font-sans`}>
      <div className="fixed inset-0 pointer-events-none z-0">
        <AnimatePresence>
          {isListening && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.1 }} exit={{ opacity: 0 }} className="absolute inset-0 flex items-center justify-center">
              <div className="w-[800px] h-[800px] rounded-full border border-primary/20 animate-ping" style={{ animationDuration: '3s' }} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="z-10 w-full max-w-xl mx-auto text-center space-y-12">
        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-7xl md:text-8xl tracking-tighter uppercase transition-colors duration-500"
            data-testid="text-title"
          >
            {penalty === "RED" || penalty === "DOG_WHISTLE"
              ? "EXPELLED"
              : penalty === "YELLOW"
                ? "WARNED"
                : penalty === "GREEN"
                  ? "FAIR PLAY"
                  : "The Referee"}
          </motion.div>

          <div className="flex items-center justify-center gap-3" data-testid="panel-card-controls">
            <button
              type="button"
              onClick={drawCard}
              className="group inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white/90 shadow-lg shadow-black/20 backdrop-blur-xl transition-all hover:bg-white/10 hover:shadow-xl active:scale-[0.98]"
              data-testid="button-draw-card"
            >
              <Layers className="h-4 w-4 opacity-80 transition-opacity group-hover:opacity-100" />
              Draw
              <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] text-white/70" data-testid="text-deck-count">
                {deckCount}
              </span>
            </button>

            <button
              type="button"
              onClick={shuffleDeck}
              className="group inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white/90 shadow-lg shadow-black/20 backdrop-blur-xl transition-all hover:bg-white/10 hover:shadow-xl active:scale-[0.98]"
              data-testid="button-shuffle-deck"
            >
              <Shuffle className="h-4 w-4 opacity-80 transition-opacity group-hover:opacity-100" />
              Shuffle
            </button>

            <button
              type="button"
              onClick={recyclePileIntoDeck}
              className="group inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white/90 shadow-lg shadow-black/20 backdrop-blur-xl transition-all hover:bg-white/10 hover:shadow-xl active:scale-[0.98]"
              data-testid="button-recycle-pile"
            >
              <Undo2 className="h-4 w-4 opacity-80 transition-opacity group-hover:opacity-100" />
              Recycle
              <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 font-mono text-[10px] text-white/70" data-testid="text-pile-count">
                {pileCount}
              </span>
            </button>

            <button
              type="button"
              onClick={resetCards}
              className="group inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-black uppercase tracking-widest text-white/90 shadow-lg shadow-black/20 backdrop-blur-xl transition-all hover:bg-white/10 hover:shadow-xl active:scale-[0.98]"
              data-testid="button-reset-cards"
            >
              <Eye className="h-4 w-4 opacity-80 transition-opacity group-hover:opacity-100" />
              New
            </button>
          </div>
        </div>

        <div className="relative h-80 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {penalty === "NONE" ? (
              <motion.div key="voice-ui" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.5, filter: "blur(10px)" }} className="w-full flex flex-col items-center">
                <div className="relative w-48 h-48 flex items-center justify-center cursor-pointer group" onClick={toggleListening}>
                  {[...Array(3)].map((_, i) => (
                    <motion.div key={i} className="absolute inset-0 rounded-full border-2 border-primary/30" animate={{ scale: isListening ? [1, 1.5, 1] : 1, opacity: isListening ? [0.5, 0, 0.5] : 0.2 }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.6, ease: "easeInOut" }} />
                  ))}
                  <motion.div animate={{ 
                    scale: isListening ? [1, 1.1, 1] : 1, 
                    backgroundColor: isScanning ? "rgb(168, 85, 247)" : isListening ? "rgb(239, 68, 68)" : "rgb(30, 41, 59)" 
                  }} className={`w-32 h-32 rounded-full flex items-center justify-center z-10 shadow-2xl transition-all duration-300 ${isListening ? 'text-white' : 'text-slate-400 border-2 border-slate-800'}`}>
                    {isScanning ? <Fingerprint className="w-16 h-16 animate-pulse" /> : isListening ? <Waves className="w-16 h-16 animate-pulse" /> : <Mic className="w-16 h-16" />}
                  </motion.div>
                </div>

                <div className="mt-12 min-h-[120px] flex flex-col items-center justify-start gap-4 w-full">
                  {isListening ? (
                    <div className="flex flex-col items-center gap-8 w-full max-w-md">
                      <div className="flex gap-1.5 items-end h-10">
                        {[...Array(16)].map((_, i) => (
                          <motion.div key={i} className="w-2 rounded-full bg-gradient-to-t from-primary to-primary/40" animate={{ height: isScanning ? [40, 60, 40] : [10, Math.random() * 30 + 10, 10] }} transition={{ repeat: Infinity, duration: 0.3 + (i * 0.05), ease: "easeInOut" }} />
                        ))}
                      </div>
                      <div className={`bg-white/5 backdrop-blur-xl p-6 rounded-2xl border transition-colors duration-500 ${isScanning ? 'border-purple-500/50 bg-purple-500/10' : 'border-white/10'} w-full shadow-2xl`}>
                        <p className="text-xl font-medium text-slate-200 italic leading-relaxed">
                          {isScanning ? (
                            <span className="text-purple-400 animate-pulse font-bold tracking-widest uppercase text-sm">Performing Nuance Deep Scan...</span>
                          ) : transcript || lastInterimRef.current ? (
                            `"${transcript || lastInterimRef.current}..."`
                          ) : (
                            <span className="text-slate-500 opacity-50">Speak now, I'm listening...</span>
                          )}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-500 font-mono text-xs tracking-widest flex items-center gap-2">
                      <Zap className="w-3 h-3 text-primary animate-pulse" /> Tap to Start Monitor
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div key={penalty} initial={{ rotateY: 270, scale: 0, y: 100 }} animate={{ rotateY: 0, scale: 1.5, y: 0 }} transition={{ type: "spring", stiffness: 150, damping: 12 }} className="perspective-1000 z-50">
                 <div className={`w-40 h-60 ${penalty === "RED" || penalty === "DOG_WHISTLE" ? "bg-[#ff0000]" : penalty === "YELLOW" ? "bg-[#ffcc00]" : "bg-[#10b981]"} rounded-xl shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] border-4 border-white/40 flex flex-col items-center justify-center relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/50 via-transparent to-black/30" />
                    {(penalty === "RED" || penalty === "DOG_WHISTLE") && <CircleOff className="w-20 h-20 mb-4 text-red-950/50" />}
                    {penalty === "YELLOW" && <AlertTriangle className="w-20 h-20 mb-4 text-amber-950/50" />}
                    {penalty === "GREEN" && <CheckCircle2 className="w-20 h-20 mb-4 text-emerald-950/50" />}
                    <div className="absolute bottom-4 right-4 text-black/20 font-display text-7xl">
                      {penalty === "RED" || penalty === "DOG_WHISTLE" ? "!!" : penalty === "YELLOW" ? "!" : "✓"}
                    </div>
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {showShame && (
            <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div className="bg-white/5 backdrop-blur-2xl p-10 rounded-[40px] border border-white/10 shadow-2xl">
                <h2 className={`font-display text-5xl mb-4 uppercase tracking-tighter ${penalty === "RED" || penalty === "DOG_WHISTLE" ? "text-red-500" : penalty === "YELLOW" ? "text-amber-500" : "text-emerald-500"}`}>
                  {penalty === "RED" || penalty === "DOG_WHISTLE" ? "EXPULSION" : penalty === "YELLOW" ? "WARNING" : "FAIR PLAY"}
                </h2>
                <div className="flex flex-col gap-2">
                  <p className="text-xl font-medium text-slate-300 max-w-sm mx-auto">
                    {history[0]?.reason}
                  </p>
                  <p className="text-sm font-mono text-slate-500 opacity-70">
                    Incident ID: {history[0]?.id}
                  </p>
                </div>
              </div>
              <button onClick={reset} className="group flex items-center justify-center gap-4 mx-auto px-12 py-6 bg-primary text-white rounded-full font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-primary/40">
                <RefreshCw className="w-6 h-6 group-hover:rotate-180 transition-transform duration-700" /> Reset Match
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {history.length > 0 && penalty === "NONE" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4 pt-12 border-t border-white/5">
            <div className="flex items-center justify-center gap-2 text-slate-500 font-bold uppercase tracking-widest text-[10px]">
              <History className="w-3 h-3" /> Recent Incidents
            </div>
            <div className="flex flex-col gap-2 max-w-sm mx-auto">
              {history.map((item) => (
                <div key={item.id} className="bg-white/5 p-3 rounded-xl border border-white/10 flex items-center gap-4 text-left">
                  <div className={`w-2 h-8 rounded-full ${item.type === "RED" || item.type === "DOG_WHISTLE" ? 'bg-red-500' : item.type === "YELLOW" ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase text-slate-500 truncate">{item.reason}</p>
                    <p className="text-xs text-slate-300 truncate italic">"{item.transcript}"</p>
                  </div>
                  <div className="text-[8px] font-mono text-slate-600">
                    {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {penalty === "NONE" && !isListening && (
           <div className="pt-8 text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2">
             <PowerOff className="w-3 h-3" /> Monitor Offline
           </div>
        )}
      </div>
    </div>
  );
}
