import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, AlertTriangle, RefreshCw, Flag, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// List of offensive trigger words (curated for strict monitoring)
const RED_CARD_TRIGGERS = ["racist", "bigot", "hate", "slur", "nazi", "supremacy"];
const YELLOW_CARD_TRIGGERS = ["stupid", "ugly", "idiot", "dumb", "shut up", "jerk"];

type PenaltyType = "NONE" | "YELLOW" | "RED";

export default function Home() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [penalty, setPenalty] = useState<PenaltyType>("NONE");
  const [showShame, setShowShame] = useState(false);
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
      };
      
      recognition.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (!recognition.current) {
      toast({
        title: "Browser not supported",
        description: "Your browser doesn't support speech recognition.",
        variant: "destructive",
      });
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
    }
  };

  const checkContent = (text: string) => {
    const lowerText = text.toLowerCase();
    
    // Check Red Card Triggers first
    if (RED_CARD_TRIGGERS.some((word) => lowerText.includes(word))) {
      triggerPenalty("RED");
      return;
    }

    // Check Yellow Card Triggers
    if (YELLOW_CARD_TRIGGERS.some((word) => lowerText.includes(word))) {
      if (penalty !== "RED") {
        triggerPenalty("YELLOW");
      }
    }
  };

  const triggerPenalty = (type: PenaltyType) => {
    setPenalty(type);
    if (type === "RED" && recognition.current) recognition.current.stop();
    setIsListening(false);
    playWhistle(type);
    
    setTimeout(() => {
      setShowShame(true);
    }, 1500);
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
  };

  const getBgColor = () => {
    if (penalty === "RED") return "bg-red-950";
    if (penalty === "YELLOW") return "bg-amber-950";
    return "bg-background";
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-1000 ${getBgColor()}`}>
      
      <div className="fixed inset-0 pointer-events-none opacity-5 z-0" 
           style={{ backgroundImage: 'radial-gradient(circle at center, black 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
      </div>

      <div className="z-10 w-full max-w-md mx-auto text-center space-y-8">
        
        <div className="space-y-2">
          <h1 className={`font-display text-5xl tracking-tight uppercase transition-colors duration-500 ${penalty !== "NONE" ? 'text-white' : 'text-primary'}`}>
            {penalty === "RED" ? "EXPULSION!" : penalty === "YELLOW" ? "WARNING!" : "The Referee"}
          </h1>
          <p className={`font-medium ${penalty !== "NONE" ? 'text-white/70' : 'text-muted-foreground'}`}>
            {penalty === "NONE" ? "Monitoring for toxicity." : "Violation recorded."}
          </p>
        </div>

        <div className="relative h-64 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {penalty === "NONE" ? (
              <motion.div 
                key="listening-ui"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="w-full"
              >
                <div className="relative group cursor-pointer" onClick={toggleListening}>
                  <div className={`absolute inset-0 rounded-full bg-primary/20 blur-xl transition-all duration-500 ${isListening ? 'scale-150 opacity-100' : 'scale-100 opacity-0'}`} />
                  <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center border-4 transition-all duration-300 ${isListening ? 'border-primary bg-primary text-white scale-110' : 'border-muted bg-white text-foreground hover:border-primary'}`}>
                    <Mic className={`w-12 h-12 ${isListening ? 'animate-pulse' : ''}`} />
                  </div>
                </div>
                
                <div className="mt-8 h-16 flex items-center justify-center">
                  {isListening ? (
                     <div className="flex gap-1 items-center justify-center h-full">
                       {[1,2,3,4,5].map((i) => (
                         <motion.div
                           key={i}
                           className="w-1 bg-primary"
                           animate={{ height: [10, 24, 10] }}
                           transition={{ repeat: Infinity, duration: 0.5 + (i * 0.1), ease: "linear" }}
                         />
                       ))}
                     </div>
                  ) : (
                    <p className="text-sm text-muted-foreground font-mono">Click mic to start session</p>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key={penalty}
                initial={{ rotateY: 90, scale: 0.5, z: -100 }}
                animate={{ rotateY: 0, scale: 1.2, z: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="perspective-1000"
              >
                 <div className={`w-48 h-72 ${penalty === "RED" ? "bg-[#ff0000]" : "bg-[#ffcc00]"} rounded-xl shadow-2xl border-4 border-white/20 flex items-center justify-center relative overflow-hidden transform-style-3d`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
                    <ShieldAlert className={`w-20 h-20 ${penalty === "RED" ? "text-red-900/40" : "text-amber-900/40"}`} />
                    <div className="absolute bottom-4 right-4 text-black/20 font-display text-6xl">
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
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className={`backdrop-blur-md p-6 rounded-lg border border-white/20 text-white shadow-xl ${penalty === "RED" ? "bg-red-500/20" : "bg-amber-500/20"}`}>
                <h2 className={`font-display text-3xl mb-2 uppercase ${penalty === "RED" ? "text-red-400" : "text-amber-400"}`}>
                  {penalty} CARD ISSUED
                </h2>
                <p className="text-lg font-medium leading-relaxed">
                  {penalty === "RED" 
                    ? "Extreme toxicity detected. Immediate expulsion." 
                    : "Caution: Offensive language detected. Adjust your behavior."}
                </p>
              </div>
              
              <button 
                onClick={reset}
                className="group flex items-center justify-center gap-2 mx-auto px-6 py-3 bg-white text-black rounded-full font-bold hover:bg-gray-100 transition-colors shadow-lg"
              >
                <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                Reset Field
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {!showShame && (
          <div className="pt-12 border-t border-border mt-12 grid grid-cols-2 gap-4">
             <button onClick={() => triggerPenalty("YELLOW")} className="flex items-center justify-center gap-2 p-3 text-xs bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-md hover:bg-amber-500/20 transition-all">
               <Flag className="w-4 h-4" /> Test Yellow
             </button>
             <button onClick={() => triggerPenalty("RED")} className="flex items-center justify-center gap-2 p-3 text-xs bg-red-500/10 text-red-500 border border-red-500/20 rounded-md hover:bg-red-500/20 transition-all">
               <AlertTriangle className="w-4 h-4" /> Test Red
             </button>
          </div>
        )}
      </div>
    </div>
  );
}
