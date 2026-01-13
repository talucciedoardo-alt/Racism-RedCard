import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, AlertTriangle, RefreshCw, Flag, ShieldAlert, Settings2, Keyboard, Ghost } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// List of offensive trigger words (curated for strict monitoring)
const RED_CARD_TRIGGERS = ["racist", "bigot", "hate", "slur", "nazi", "supremacy"];
const YELLOW_CARD_TRIGGERS = ["stupid", "ugly", "idiot", "dumb", "shut up", "jerk"];

type PenaltyType = "NONE" | "YELLOW" | "RED";

export default function Home() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [textInput, setTextInput] = useState("");
  const [penalty, setPenalty] = useState<PenaltyType>("NONE");
  const [showShame, setShowShame] = useState(false);
  const [useTextMode, setUseTextMode] = useState(true); // Defaulting to text mode since mic is unreliable in frames
  const { toast } = useToast();

  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognition = useRef<any>(null);

  useEffect(() => {
    if (SpeechRecognition) {
      recognition.current = new SpeechRecognition();
      recognition.current.continuous = true;
      recognition.current.interimResults = true;
      recognition.current.lang = "en-US";

      recognition.current.onresult = (event: any) => {
        const current = event.resultIndex;
        const transcriptText = event.results[current][0].transcript;
        setTranscript(transcriptText);
        checkContent(transcriptText);
      };

      recognition.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
        setUseTextMode(true);
        toast({
          title: "Microphone Access Failed",
          description: "Falling back to Text Mode. This is common in secured browser environments.",
        });
      };
      
      recognition.current.onend = () => {
        setIsListening(false);
      };
    } else {
      setUseTextMode(true);
    }
  }, []);

  const toggleListening = () => {
    if (!recognition.current) {
      toast({
        title: "Voice Not Supported",
        description: "Your browser doesn't support speech recognition. Use Text Mode instead.",
      });
      setUseTextMode(true);
      return;
    }

    if (isListening) {
      recognition.current.stop();
    } else {
      setPenalty("NONE");
      setShowShame(false);
      setTranscript("");
      recognition.current.start();
      setIsListening(true);
      setUseTextMode(false);
    }
  };

  const checkContent = (text: string) => {
    const lowerText = text.toLowerCase();
    
    if (RED_CARD_TRIGGERS.some((word) => lowerText.includes(word))) {
      triggerPenalty("RED");
      return;
    }

    if (YELLOW_CARD_TRIGGERS.some((word) => lowerText.includes(word))) {
      if (penalty !== "RED") {
        triggerPenalty("YELLOW");
      }
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    checkContent(textInput);
    setTextInput("");
  };

  const triggerPenalty = (type: PenaltyType) => {
    setPenalty(type);
    if (type === "RED" && recognition.current) recognition.current.stop();
    setIsListening(false);
    playWhistle(type);
    
    setTimeout(() => {
      setShowShame(true);
    }, 1200);
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
      const baseFreq = type === "RED" ? 2500 : 1800;
      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(baseFreq - 500, ctx.currentTime + 0.1);
      osc.frequency.linearRampToValueAtTime(baseFreq + 500, ctx.currentTime + 0.2);
      
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (type === "RED" ? 1.0 : 0.5));
      
      osc.start();
      osc.stop(ctx.currentTime + (type === "RED" ? 1.0 : 0.5));
    }
  };

  const reset = () => {
    setPenalty("NONE");
    setShowShame(false);
    setTranscript("");
    setTextInput("");
  };

  const getBgColor = () => {
    if (penalty === "RED") return "bg-red-950";
    if (penalty === "YELLOW") return "bg-amber-950";
    return "bg-background";
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 transition-all duration-1000 ${getBgColor()}`}>
      
      <div className="fixed inset-0 pointer-events-none opacity-5 z-0" 
           style={{ backgroundImage: 'radial-gradient(circle at center, black 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
      </div>

      <div className="z-10 w-full max-w-lg mx-auto text-center space-y-8">
        
        <div className="space-y-2">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className={`font-display text-6xl tracking-tighter uppercase transition-colors duration-500 ${penalty !== "NONE" ? 'text-white' : 'text-primary'}`}>
              {penalty === "RED" ? "EXPULSION" : penalty === "YELLOW" ? "WARNING" : "The Referee"}
            </h1>
          </motion.div>
          <p className={`font-medium tracking-widest uppercase text-xs ${penalty !== "NONE" ? 'text-white/70' : 'text-muted-foreground'}`}>
            {penalty === "NONE" ? "Zero Tolerance Environment" : "Rules Violation Detected"}
          </p>
        </div>

        <div className="relative h-72 flex items-center justify-center perspective-1000">
          <AnimatePresence mode="wait">
            {penalty === "NONE" ? (
              <motion.div 
                key="main-ui"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="w-full space-y-8"
              >
                {/* Interaction Modes */}
                <div className="flex justify-center gap-4 mb-8">
                  <button 
                    onClick={() => setUseTextMode(false)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${!useTextMode ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-secondary text-secondary-foreground opacity-50'}`}
                  >
                    <Mic className="w-3 h-3" /> Voice
                  </button>
                  <button 
                    onClick={() => setUseTextMode(true)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${useTextMode ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-secondary text-secondary-foreground opacity-50'}`}
                  >
                    <Keyboard className="w-3 h-3" /> Text
                  </button>
                </div>

                {!useTextMode ? (
                  <div className="relative group cursor-pointer mx-auto" onClick={toggleListening}>
                    <div className={`absolute inset-0 rounded-full bg-primary/20 blur-2xl transition-all duration-500 ${isListening ? 'scale-150 opacity-100' : 'scale-100 opacity-0'}`} />
                    <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center border-8 transition-all duration-300 ${isListening ? 'border-primary bg-primary text-white scale-110 rotate-12' : 'border-muted bg-white text-foreground hover:border-primary shadow-xl'}`}>
                      <Mic className={`w-12 h-12 ${isListening ? 'animate-pulse' : ''}`} />
                    </div>
                  </div>
                ) : (
                  <motion.form 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onSubmit={handleTextSubmit}
                    className="relative max-w-sm mx-auto"
                  >
                    <input 
                      type="text"
                      value={textInput}
                      onChange={(e) => setTextInput(e.target.value)}
                      placeholder="Type something..."
                      className="w-full bg-white border-2 border-muted rounded-2xl px-6 py-4 text-lg font-medium focus:border-primary focus:outline-none transition-all shadow-xl"
                    />
                    <button type="submit" className="absolute right-2 top-2 bottom-2 px-4 bg-primary text-white rounded-xl font-bold text-sm hover:scale-105 transition-transform">
                      Check
                    </button>
                  </motion.form>
                )}
                
                <div className="h-12 flex items-center justify-center">
                  <AnimatePresence>
                    {isListening && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-1">
                        {[1,2,3,4,5,6].map((i) => (
                          <motion.div
                            key={i}
                            className="w-1.5 rounded-full bg-primary"
                            animate={{ height: [12, 32, 12] }}
                            transition={{ repeat: Infinity, duration: 0.4 + (i * 0.05) }}
                          />
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={penalty}
                initial={{ rotateY: 180, scale: 0, z: -500 }}
                animate={{ rotateY: 0, scale: 1.3, z: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="transform-style-3d"
              >
                 <div className={`w-48 h-72 ${penalty === "RED" ? "bg-[#ff0000]" : "bg-[#ffcc00]"} rounded-2xl shadow-[0_40px_80px_-15px_rgba(0,0,0,0.5)] border-4 border-white/30 flex flex-col items-center justify-center relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-black/20 pointer-events-none" />
                    <ShieldAlert className={`w-24 h-24 mb-4 ${penalty === "RED" ? "text-red-900/40" : "text-amber-900/40"}`} />
                    <p className={`font-display text-2xl ${penalty === "RED" ? "text-red-900/60" : "text-amber-900/60"}`}>
                      {penalty} CARD
                    </p>
                    <div className="absolute bottom-4 right-4 text-black/10 font-display text-8xl">
                      {penalty === "RED" ? "!!" : "!"}
                    </div>
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {showShame && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className={`backdrop-blur-xl p-8 rounded-3xl border-2 shadow-2xl transition-all ${penalty === "RED" ? "bg-red-500/10 border-red-500/30 text-red-100" : "bg-amber-500/10 border-amber-500/30 text-amber-100"}`}>
                <div className="flex justify-center mb-4">
                  <Ghost className="w-12 h-12 animate-bounce" />
                </div>
                <h2 className={`font-display text-4xl mb-3 uppercase tracking-tighter ${penalty === "RED" ? "text-red-500" : "text-amber-500"}`}>
                  {penalty === "RED" ? "Permanent Ban" : "Final Warning"}
                </h2>
                <p className="text-xl font-medium opacity-90 leading-tight italic">
                  "{penalty === "RED" 
                    ? "Your conduct is unacceptable. Exit immediately." 
                    : "This behavior will not be tolerated. Correct yourself."}"
                </p>
              </div>
              
              <button 
                onClick={reset}
                className="group flex items-center justify-center gap-3 mx-auto px-10 py-5 bg-white text-black rounded-2xl font-black uppercase tracking-tighter hover:bg-gray-100 active:scale-95 transition-all shadow-2xl"
              >
                <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-700" />
                Return to Game
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {penalty === "NONE" && (
          <div className="pt-8 grid grid-cols-2 gap-3 max-w-sm mx-auto opacity-50 hover:opacity-100 transition-opacity">
             <button onClick={() => triggerPenalty("YELLOW")} className="flex items-center justify-center gap-2 p-3 text-[10px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-xl">
               <Flag className="w-3 h-3" /> Warning
             </button>
             <button onClick={() => triggerPenalty("RED")} className="flex items-center justify-center gap-2 p-3 text-[10px] font-bold uppercase tracking-widest bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl">
               <AlertTriangle className="w-3 h-3" /> Expulsion
             </button>
          </div>
        )}
      </div>
    </div>
  );
}
