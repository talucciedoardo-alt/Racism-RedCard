import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, AlertTriangle, RefreshCw, Volume2, Flag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Mock list of trigger words (using safe placeholders/generic terms for demonstration)
const TRIGGER_WORDS = ["bad", "hate", "offense", "racist", "ugly", "stupid"];

export default function Home() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [penalty, setPenalty] = useState(false);
  const [showShame, setShowShame] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { toast } = useToast();

  // Initialize Speech Recognition
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
        description: "Your browser doesn't support speech recognition. Try simulated mode.",
        variant: "destructive",
      });
      return;
    }

    if (isListening) {
      recognition.current.stop();
    } else {
      setPenalty(false); // Reset on new session
      setShowShame(false);
      setTranscript("");
      recognition.current.start();
      setIsListening(true);
    }
  };

  const checkContent = (text: string) => {
    const lowerText = text.toLowerCase();
    const hasTrigger = TRIGGER_WORDS.some((word) => lowerText.includes(word));

    if (hasTrigger && !penalty) {
      triggerPenalty();
    }
  };

  const triggerPenalty = () => {
    setPenalty(true);
    if (recognition.current) recognition.current.stop();
    setIsListening(false);
    playWhistle();
    
    // Show shame message after card animation
    setTimeout(() => {
      setShowShame(true);
    }, 1500);
  };

  const playWhistle = () => {
    // Creating a simple oscillator sound since we can't reliably link external MP3s without them breaking
    const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      // Whistle sound simulation (high pitch, fluctuating)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2000, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(1500, ctx.currentTime + 0.1);
      osc.frequency.linearRampToValueAtTime(2500, ctx.currentTime + 0.2);
      osc.frequency.linearRampToValueAtTime(1800, ctx.currentTime + 0.3);
      
      gain.gain.setValueAtTime(0.5, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    }
  };

  const manualTrigger = () => {
    setTranscript("Simulated offensive phrase detected...");
    triggerPenalty();
  };

  const reset = () => {
    setPenalty(false);
    setShowShame(false);
    setTranscript("");
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-1000 ${penalty ? 'bg-red-950' : 'bg-background'}`}>
      
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none opacity-5 z-0" 
           style={{ backgroundImage: 'radial-gradient(circle at center, black 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
      </div>

      <div className="z-10 w-full max-w-md mx-auto text-center space-y-8">
        
        {/* Header */}
        <div className="space-y-2">
          <h1 className={`font-display text-5xl tracking-tight uppercase ${penalty ? 'text-white' : 'text-primary'}`}>
            {penalty ? "VIOLATION!" : "The Referee"}
          </h1>
          <p className={`font-medium ${penalty ? 'text-red-200' : 'text-muted-foreground'}`}>
            Listening for foul play.
          </p>
        </div>

        {/* Main Interaction Area */}
        <div className="relative h-64 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {!penalty ? (
              <motion.div 
                key="listening-ui"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
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
                    <p className="text-sm text-muted-foreground font-mono">Press microphone to start monitoring</p>
                  )}
                </div>

                {transcript && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 rounded-lg bg-secondary/5 text-sm font-mono text-left w-full border border-dashed border-border"
                  >
                    <span className="text-muted-foreground opacity-50">{">"}</span> {transcript}
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="red-card"
                initial={{ rotateY: 90, scale: 0.5, z: -100 }}
                animate={{ rotateY: 0, scale: 1.2, z: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="perspective-1000"
              >
                 <div className="w-48 h-72 bg-[#ff0000] rounded-xl shadow-2xl border-4 border-white/20 flex items-center justify-center relative overflow-hidden transform-style-3d">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
                    <div className="absolute bottom-4 right-4 text-red-900/40 font-display text-6xl">!</div>
                 </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Shame Message */}
        <AnimatePresence>
          {showShame && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-white/10 backdrop-blur-md p-6 rounded-lg border border-white/20 text-white shadow-xl">
                <h2 className="font-display text-3xl mb-2 text-yellow-300 uppercase">Red Card!</h2>
                <p className="text-lg font-medium leading-relaxed">
                  Offensive language detected. <br/>
                  <span className="font-bold bg-black/30 px-2 py-1 rounded mt-2 inline-block">Go sit in the corner.</span>
                </p>
              </div>
              
              <button 
                onClick={reset}
                className="group flex items-center justify-center gap-2 mx-auto px-6 py-3 bg-white text-red-600 rounded-full font-bold hover:bg-gray-100 transition-colors shadow-lg"
              >
                <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                Apologize & Reset
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Debug Controls */}
        {!penalty && (
          <div className="pt-12 border-t border-border mt-12">
            <div className="text-xs font-mono text-muted-foreground mb-4 uppercase tracking-widest">Simulation Controls</div>
            <div className="flex justify-center gap-4">
               <button 
                 onClick={manualTrigger}
                 className="flex items-center gap-2 px-4 py-2 text-sm bg-secondary text-secondary-foreground rounded-md hover:opacity-90 transition-opacity"
               >
                 <Flag className="w-4 h-4" />
                 Simulate Offense
               </button>
               <div className="flex items-center gap-2 px-4 py-2 text-xs bg-muted text-muted-foreground rounded-md">
                 <AlertTriangle className="w-3 h-3" />
                 Triggers: "bad", "hate", "racist"
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
