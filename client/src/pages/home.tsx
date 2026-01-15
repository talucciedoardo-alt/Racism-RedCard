import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, AlertTriangle, RefreshCw, Flag, ShieldAlert, Zap, Waves, CheckCircle2, CircleOff, PowerOff, StopCircle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ANALYSIS_MAP = {
  RED: [
    "racist", "bigot", "hate", "slur", "nazi", "supremacy", 
    "discrimination", "segregation", "prejudice", "intolerance",
    "homophobic", "transphobic", "sexist", "misogynistic", "misandrist",
    "xenophobic", "ableist", "antisemitic", "islamophobic"
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

type PenaltyType = "NONE" | "YELLOW" | "RED" | "GREEN" | "NEUTRAL";

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

  const handleFinishSpeaking = () => {
    const textToProcess = lastInterimRef.current || transcript;
    if (textToProcess) {
      setTranscript(textToProcess);
      processContent(textToProcess);
      lastInterimRef.current = "";
    } else {
      stopAllRecognition();
    }
  };

  const processContent = (text: string) => {
    const lowerText = text.toLowerCase().trim();
    if (!lowerText) return;

    let decision: PenaltyType = "NEUTRAL";

    // Split text into words to check against analysis map
    const words = lowerText.split(/\s+/);
    
    let isRed = false;
    let isYellow = false;
    let isGreen = false;

    for (const word of words) {
      if (ANALYSIS_MAP.RED.some(trigger => word.includes(trigger))) isRed = true;
      if (ANALYSIS_MAP.YELLOW.some(trigger => word.includes(trigger))) isYellow = true;
      if (ANALYSIS_MAP.GREEN.some(trigger => word.includes(trigger))) isGreen = true;
    }

    if (isRed) decision = "RED";
    else if (isYellow) decision = "YELLOW";
    else if (isGreen) decision = "GREEN";

    triggerPenalty(decision);
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
      else if (type === "NEUTRAL") { baseFreq = 1500; duration = 0.3; }

      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      if (type === "RED" || type === "YELLOW") {
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

  const getBgColor = () => {
    if (penalty === "RED") return "bg-red-950";
    if (penalty === "YELLOW") return "bg-amber-950";
    if (penalty === "GREEN") return "bg-emerald-950";
    if (penalty === "NEUTRAL") return "bg-slate-900";
    return "bg-slate-950";
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
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="font-display text-7xl md:text-8xl tracking-tighter uppercase transition-colors duration-500">
            {penalty === "RED" ? "EXPELLED" : penalty === "YELLOW" ? "WARNED" : penalty === "GREEN" ? "FAIR PLAY" : penalty === "NEUTRAL" ? "PLAY ON" : "The Referee"}
          </motion.div>
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

                <div className="mt-12 h-20 flex flex-col items-center justify-center gap-4">
                  {isListening ? (
                    <div className="flex flex-col items-center gap-6">
                      <div className="flex gap-1.5 items-end">
                        {[...Array(16)].map((_, i) => (
                          <motion.div key={i} className="w-2 rounded-full bg-gradient-to-t from-primary to-primary/40" animate={{ height: [20, Math.random() * 60 + 20, 20] }} transition={{ repeat: Infinity, duration: 0.3 + (i * 0.05), ease: "easeInOut" }} />
                        ))}
                      </div>
                      <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFinishSpeaking();
                        }}
                        className="flex items-center gap-2 px-8 py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20"
                      >
                        <StopCircle className="w-5 h-5" /> I'm Finished
                      </motion.button>
                    </div>
                  ) : (
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
                 <div className={`w-40 h-60 ${penalty === "RED" ? "bg-[#ff0000]" : penalty === "YELLOW" ? "bg-[#ffcc00]" : penalty === "GREEN" ? "bg-[#10b981]" : "bg-[#475569]"} rounded-xl shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] border-4 border-white/40 flex flex-col items-center justify-center relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/50 via-transparent to-black/30" />
                    {penalty === "RED" && <CircleOff className="w-20 h-20 mb-4 text-red-950/50" />}
                    {penalty === "YELLOW" && <AlertTriangle className="w-20 h-20 mb-4 text-amber-950/50" />}
                    {penalty === "GREEN" && <CheckCircle2 className="w-20 h-20 mb-4 text-emerald-950/50" />}
                    {penalty === "NEUTRAL" && <Info className="w-20 h-20 mb-4 text-slate-300/50" />}
                    <div className="absolute bottom-4 right-4 text-black/20 font-display text-7xl">
                      {penalty === "RED" ? "!!" : penalty === "YELLOW" ? "!" : penalty === "GREEN" ? "✓" : "•"}
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
                <h2 className={`font-display text-5xl mb-4 uppercase tracking-tighter ${penalty === "RED" ? "text-red-500" : penalty === "YELLOW" ? "text-amber-500" : "text-emerald-500"}`}>
                  {penalty === "RED" ? "EXPULSION" : penalty === "YELLOW" ? "WARNING" : "FAIR PLAY"}
                </h2>
                <p className="text-xl font-medium text-slate-300 max-w-sm mx-auto">
                  {penalty === "RED" ? "Severe toxicity detected. Expulsion issued." : 
                   penalty === "YELLOW" ? "Caution! Offensive language detected." : 
                   penalty === "GREEN" ? "Exemplary conduct detected. Keep it up!" :
                   "No violation detected. Carry on with the match."}
                </p>
              </div>
              <button onClick={reset} className="group flex items-center justify-center gap-4 mx-auto px-12 py-6 bg-primary text-white rounded-full font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-primary/40">
                <RefreshCw className="w-6 h-6 group-hover:rotate-180 transition-transform duration-700" /> Reset Match
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {penalty === "NONE" && (
          <div className="pt-12 flex justify-center gap-6 opacity-40 hover:opacity-100 transition-opacity flex-wrap">
             <button onClick={() => triggerPenalty("GREEN")} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-500 border border-emerald-500/20 px-3 py-2 rounded-lg bg-emerald-500/5">
               <CheckCircle2 className="w-3.5 h-3.5" /> Green (Fair Play)
             </button>
             <button onClick={() => triggerPenalty("NEUTRAL")} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 border border-slate-500/20 px-3 py-2 rounded-lg bg-slate-500/5">
               <Info className="w-3.5 h-3.5" /> Neutral (Play On)
             </button>
             <button onClick={() => triggerPenalty("YELLOW")} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-500 border border-amber-500/20 px-3 py-2 rounded-lg bg-amber-500/5">
               <AlertTriangle className="w-3.5 h-3.5" /> Yellow (Warning)
             </button>
             <button onClick={() => triggerPenalty("RED")} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-red-500 border border-red-500/20 px-3 py-2 rounded-lg bg-red-500/5">
               <CircleOff className="w-3.5 h-3.5" /> Red (Expulsion)
             </button>
          </div>
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
