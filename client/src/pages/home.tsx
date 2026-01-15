import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, AlertTriangle, RefreshCw, Flag, ShieldAlert, Zap, Waves, CheckCircle2, CircleOff, PowerOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Expanded list of triggers for better detection
const RED_CARD_TRIGGERS = [
  "racist", "bigot", "hate", "slur", "nazi", "supremacy", 
  "discrimination", "segregation", "prejudice", "intolerance"
];
const YELLOW_CARD_TRIGGERS = [
  "stupid", "ugly", "idiot", "dumb", "shut up", "jerk", 
  "trash", "garbage", "loser", "annoying", "hate you"
];
const GREEN_CARD_TRIGGERS = [
  "kindness", "respect", "love", "equality", "friend", "help", 
  "good job", "awesome", "peace", "unity", "fair play"
];

type PenaltyType = "NONE" | "YELLOW" | "RED" | "GREEN";

export default function Home() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [penalty, setPenalty] = useState<PenaltyType>("NONE");
  const [showShame, setShowShame] = useState(false);
  const { toast } = useToast();

  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognition = useRef<any>(null);
  const shouldBeListening = useRef(false);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastInterimRef = useRef("");

  // CRITICAL: Robust cleanup and session management
  const stopAllRecognition = () => {
    shouldBeListening.current = false;
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    if (recognition.current) {
      try {
        recognition.current.stop();
        // Force abort if stop doesn't work (Chrome sometimes hangs on stop)
        if (recognition.current.abort) recognition.current.abort();
      } catch (e) {
        console.error("Error stopping recognition:", e);
      }
    }
    setIsListening(false);
    lastInterimRef.current = "";
  };

  useEffect(() => {
    if (SpeechRecognition) {
      recognition.current = new SpeechRecognition();
      recognition.current.continuous = true;
      recognition.current.interimResults = true;
      recognition.current.lang = "en-US";

      recognition.current.onstart = () => {
        setIsListening(true);
      };

      recognition.current.onresult = (event: any) => {
        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            const final = event.results[i][0].transcript;
            setTranscript(final);
            checkContent(final);
            if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
            lastInterimRef.current = "";
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (interimTranscript.length > 0) {
          lastInterimRef.current = interimTranscript;
          if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
          
          // Custom silence detection to force process interim speech
          silenceTimeoutRef.current = setTimeout(() => {
            if (lastInterimRef.current && shouldBeListening.current) {
              const textToProcess = lastInterimRef.current;
              setTranscript(textToProcess);
              checkContent(textToProcess);
              lastInterimRef.current = "";
              // Soft reset to clear buffer without breaking session
              if (recognition.current) recognition.current.stop();
            }
          }, 800); 
        }
      };

      recognition.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error === 'not-allowed') {
          toast({
            title: "Permission Denied",
            description: "Please check your microphone permissions.",
            variant: "destructive",
          });
          stopAllRecognition();
        }
        // If it's a transient error, it will naturally try to restart in onend if shouldBeListening is true
      };
      
      recognition.current.onend = () => {
        // Only restart if the user explicitly wants to listen and no penalty is active
        if (shouldBeListening.current && penalty === "NONE") {
          try {
            recognition.current.start();
          } catch (e) {
            // Ignore if already started
          }
        } else {
          setIsListening(false);
        }
      };
    }

    return () => stopAllRecognition();
  }, [penalty]);

  const toggleListening = () => {
    if (!recognition.current) {
      toast({
        title: "Voice Not Supported",
        description: "Your browser doesn't support the Web Speech API.",
        variant: "destructive",
      });
      return;
    }

    if (isListening) {
      stopAllRecognition();
    } else {
      setPenalty("NONE");
      setShowShame(false);
      setTranscript("");
      shouldBeListening.current = true;
      try {
        recognition.current.start();
      } catch (e) {
        console.error("Recognition already started", e);
      }
    }
  };

  const checkContent = (text: string) => {
    const lowerText = text.toLowerCase().trim();
    if (!lowerText) return;

    if (RED_CARD_TRIGGERS.some((word) => lowerText.includes(word))) {
      triggerPenalty("RED");
      return;
    }

    if (YELLOW_CARD_TRIGGERS.some((word) => lowerText.includes(word))) {
      if (penalty !== "RED") triggerPenalty("YELLOW");
      return;
    }

    if (GREEN_CARD_TRIGGERS.some((word) => lowerText.includes(word))) {
      if (penalty === "NONE") triggerPenalty("GREEN");
    }
  };

  const triggerPenalty = (type: PenaltyType) => {
    setPenalty(type);
    stopAllRecognition();
    playWhistle(type);
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
      if (type === "RED") { baseFreq = 2800; duration = 1.2; }
      else if (type === "GREEN") { baseFreq = 1200; duration = 0.4; }
      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      if (type !== "GREEN") {
        osc.frequency.linearRampToValueAtTime(baseFreq - 800, ctx.currentTime + 0.1);
        osc.frequency.linearRampToValueAtTime(baseFreq + 800, ctx.currentTime + 0.2);
      } else {
        osc.frequency.linearRampToValueAtTime(baseFreq + 400, ctx.currentTime + 0.2);
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

  const getBgColor = () => {
    if (penalty === "RED") return "bg-red-950";
    if (penalty === "YELLOW") return "bg-amber-950";
    if (penalty === "GREEN") return "bg-emerald-950";
    return "bg-slate-950";
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 transition-all duration-1000 ${getBgColor()} overflow-hidden`}>
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
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="inline-block px-4 py-1 rounded-full border border-primary/20 bg-primary/5 backdrop-blur-sm mb-4">
            <span className="text-[10px] font-black tracking-[0.3em] uppercase text-primary">Zero Tolerance Active</span>
          </motion.div>
          <h1 className="font-display text-7xl md:text-8xl tracking-tighter uppercase transition-colors duration-500 text-white">
            {penalty === "RED" ? "EXPELLED" : penalty === "YELLOW" ? "WARNED" : penalty === "GREEN" ? "FAIR PLAY" : "The Referee"}
          </h1>
        </div>

        <div className="relative h-80 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {penalty === "NONE" ? (
              <motion.div key="voice-ui" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.5, filter: "blur(10px)" }} className="w-full flex flex-col items-center">
                <div className="relative w-48 h-48 flex items-center justify-center cursor-pointer group" onClick={toggleListening}>
                  {[...Array(3)].map((_, i) => (
                    <motion.div key={i} className="absolute inset-0 rounded-full border-2 border-primary/30" animate={{ scale: isListening ? [1, 1.5, 1] : 1, opacity: isListening ? [0.5, 0, 0.5] : 0.2 }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.6, ease: "easeInOut" }} />
                  ))}
                  <motion.div animate={{ scale: isListening ? [1, 1.1, 1] : 1, backgroundColor: isListening ? "rgb(239, 68, 68)" : "rgb(30, 41, 59)" }} className={`w-32 h-32 rounded-full flex items-center justify-center z-10 shadow-2xl transition-all duration-300 ${isListening ? 'text-white' : 'text-slate-400 border-2 border-slate-800'}`}>
                    {isListening ? <Waves className="w-16 h-16 animate-pulse" /> : <Mic className="w-16 h-16" />}
                  </motion.div>
                </div>

                <div className="mt-12 h-20 flex items-end gap-1.5">
                  {isListening ? [...Array(16)].map((_, i) => (
                    <motion.div key={i} className="w-2 rounded-full bg-gradient-to-t from-primary to-primary/40" animate={{ height: [20, Math.random() * 60 + 20, 20] }} transition={{ repeat: Infinity, duration: 0.3 + (i * 0.05), ease: "easeInOut" }} />
                  )) : (
                    <div className="text-slate-500 font-mono text-xs tracking-widest flex items-center gap-2">
                      <Zap className="w-3 h-3 text-primary animate-pulse" /> Tap to Start Monitor
                    </div>
                  )}
                </div>

                <div className="mt-4 h-8 flex items-center justify-center">
                  <AnimatePresence>
                    {transcript && isListening && (
                      <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-slate-400 italic font-medium">"{transcript}..."</motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ) : (
              <motion.div key={penalty} initial={{ rotateY: 270, scale: 0, y: 100 }} animate={{ rotateY: 0, scale: 1.5, y: 0 }} transition={{ type: "spring", stiffness: 150, damping: 12 }} className="perspective-1000 z-50">
                 <div className={`w-40 h-60 ${penalty === "RED" ? "bg-[#ff0000]" : penalty === "YELLOW" ? "bg-[#ffcc00]" : "bg-[#10b981]"} rounded-xl shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] border-4 border-white/40 flex flex-col items-center justify-center relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/50 via-transparent to-black/30" />
                    {penalty === "RED" && <CircleOff className="w-20 h-20 mb-4 text-red-950/50" />}
                    {penalty === "YELLOW" && <AlertTriangle className="w-20 h-20 mb-4 text-amber-950/50" />}
                    {penalty === "GREEN" && <CheckCircle2 className="w-20 h-20 mb-4 text-emerald-950/50" />}
                    <div className="absolute bottom-4 right-4 text-black/20 font-display text-7xl">{penalty === "RED" ? "!!" : penalty === "YELLOW" ? "!" : "✓"}</div>
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {showShame && (
            <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <div className="bg-white/5 backdrop-blur-2xl p-10 rounded-[40px] border border-white/10 shadow-2xl">
                <h2 className={`font-display text-5xl mb-4 uppercase tracking-tighter ${penalty === "RED" ? "text-red-500" : penalty === "YELLOW" ? "text-amber-500" : "text-emerald-500"}`}>
                  {penalty === "RED" ? "EXPULSION" : penalty === "YELLOW" ? "WARNING" : "FAIR PLAY"}
                </h2>
                <p className="text-xl font-medium text-slate-300 max-w-sm mx-auto">
                  {penalty === "RED" ? "Severe toxicity detected. Expulsion issued." : penalty === "YELLOW" ? "Caution! Offensive language detected." : "Exemplary conduct detected. Keep it up!"}
                </p>
              </div>
              <button onClick={reset} className="group flex items-center justify-center gap-4 mx-auto px-12 py-6 bg-primary text-white rounded-full font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-primary/40">
                <RefreshCw className="w-6 h-6 group-hover:rotate-180 transition-transform duration-700" /> Reset Field
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {penalty === "NONE" && !isListening && (
           <div className="pt-8 text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-2">
             <PowerOff className="w-3 h-3" /> Monitor Offline
           </div>
        )}
      </div>
    </div>
  );
}
