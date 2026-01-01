
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Telescope, 
  ChevronLeft,
  Compass,
  Loader2,
  Play,
  Pause,
  Square,
  Rocket,
  Zap,
  Flame,
  Activity,
  Volume2,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import GalaxyScene from './components/GalaxyScene';
import { GalaxyType, CosmicEvent } from './types';
import { GALAXY_CONFIGS, GALAXY_INTRODUCTIONS, APP_INTRODUCTION } from './constants';
import { GeminiService } from './services/geminiService';

const App: React.FC = () => {
  const gemini = useMemo(() => new GeminiService(), []);
  
  const [selectedItem, setSelectedItem] = useState<GalaxyType | CosmicEvent>(GalaxyType.SPIRAL);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  
  const [audioState, setAudioState] = useState<{
    isPlaying: boolean;
    progress: number;
    duration: number;
    currentTime: number;
  }>({ isPlaying: false, progress: 0, duration: 0, currentTime: 0 });

  const audioCache = useRef<Record<string, AudioBuffer>>({});
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startedAtRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const currentBufferRef = useRef<AudioBuffer | null>(null);

  // Stop current audio when switching items, but DON'T start a new one automatically
  useEffect(() => {
    stopAudio();
    currentBufferRef.current = null; // Clear current buffer so we know it needs regeneration or reload from cache
  }, [selectedItem]);

  const stopAudio = () => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch(e) {}
      sourceNodeRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    pausedAtRef.current = 0;
    startedAtRef.current = 0;
    setAudioState(prev => ({ ...prev, isPlaying: false, progress: 0, currentTime: 0, duration: 0 }));
  };

  const handleLoadAudio = async (type: string) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }

    let buffer: AudioBuffer;
    if (audioCache.current[type]) {
      buffer = audioCache.current[type];
    } else {
      setIsGeneratingAudio(true);
      try {
        buffer = await gemini.generateSpeech(GALAXY_INTRODUCTIONS[type]);
        audioCache.current[type] = buffer;
      } catch (err) {
        console.error("Audio generation failed:", err);
        setIsGeneratingAudio(false);
        return;
      }
      setIsGeneratingAudio(false);
    }

    currentBufferRef.current = buffer;
    setAudioState(prev => ({ ...prev, duration: buffer.duration, progress: 0, currentTime: 0 }));
    playAudio(0);
  };

  const playAudio = (offset: number) => {
    if (!currentBufferRef.current || !audioContextRef.current) return;

    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch(e) {}
    }

    const source = audioContextRef.current.createBufferSource();
    source.buffer = currentBufferRef.current;
    source.connect(audioContextRef.current.destination);
    
    source.onended = () => {
      if (currentBufferRef.current && Math.abs(audioState.currentTime - currentBufferRef.current.duration) < 0.2) {
        setAudioState(prev => ({ ...prev, isPlaying: false, progress: 100 }));
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      }
    };

    source.start(0, offset);
    sourceNodeRef.current = source;
    startedAtRef.current = audioContextRef.current.currentTime - offset;
    setAudioState(prev => ({ ...prev, isPlaying: true }));
    
    requestAnimationFrame(updateProgress);
  };

  const updateProgress = () => {
    if (!audioContextRef.current || !currentBufferRef.current || !sourceNodeRef.current) return;

    const currentTime = audioContextRef.current.currentTime - startedAtRef.current;
    const duration = currentBufferRef.current.duration;
    const progress = Math.min((currentTime / duration) * 100, 100);

    if (currentTime <= duration) {
      setAudioState(prev => ({ ...prev, currentTime, progress }));
      animationFrameRef.current = requestAnimationFrame(updateProgress);
    } else {
      setAudioState(prev => ({ ...prev, isPlaying: false, progress: 100, currentTime: duration }));
    }
  };

  const togglePlayPause = () => {
    // If we haven't loaded/generated audio for this item yet, generate it now
    if (!currentBufferRef.current && !audioCache.current[selectedItem]) {
      handleLoadAudio(selectedItem);
      return;
    }

    // If it's in cache but not in currentBufferRef (due to switch), set it and play
    if (!currentBufferRef.current && audioCache.current[selectedItem]) {
      currentBufferRef.current = audioCache.current[selectedItem];
      setAudioState(prev => ({ ...prev, duration: currentBufferRef.current!.duration }));
      playAudio(0);
      return;
    }

    if (audioState.isPlaying) {
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch(e) {}
        sourceNodeRef.current = null;
      }
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      pausedAtRef.current = audioContextRef.current!.currentTime - startedAtRef.current;
      setAudioState(prev => ({ ...prev, isPlaying: false }));
    } else {
      const offset = audioState.progress >= 100 ? 0 : pausedAtRef.current;
      playAudio(offset);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden text-white selection:bg-blue-500/30 font-vazir" dir="rtl">
      <GalaxyScene params={GALAXY_CONFIGS[selectedItem]} />

      {showWelcome && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="max-w-2xl w-full bg-slate-900/90 border border-white/10 rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden text-center">
            <div className="relative z-10">
              <div className="inline-flex p-4 bg-blue-600 rounded-2xl shadow-lg mb-6">
                <Rocket className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-8">
                کاوشگر کیهانی ۳ بعدی
              </h2>
              <div className="space-y-4 mb-10 text-slate-300 leading-relaxed text-sm md:text-base text-justify">
                {APP_INTRODUCTION.map((p, i) => <p key={i}>{p}</p>)}
              </div>
              <button 
                onClick={() => setShowWelcome(false)}
                className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl font-bold text-lg shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                آغاز سفر در پهنه هستی
                <ChevronLeft className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`absolute inset-0 z-10 pointer-events-none flex flex-row-reverse transition-opacity duration-1000 ${showWelcome ? 'opacity-0' : 'opacity-100'}`}>
        
        <aside className={`pointer-events-auto h-full bg-slate-950/60 backdrop-blur-2xl border-l border-white/10 transition-all duration-500 flex flex-col ${isSidebarOpen ? 'w-96' : 'w-0 overflow-hidden'}`}>
          <div className="p-8 border-b border-white/10">
            <h1 className="text-2xl font-black flex items-center gap-4 text-blue-400 uppercase tracking-tighter">
              <Telescope className="w-8 h-8" />
              Cosmic Explorer
            </h1>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            <section>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 px-2">انواع کهکشان‌ها</p>
              <div className="grid grid-cols-1 gap-2">
                {Object.values(GalaxyType).map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedItem(type)}
                    className={`w-full p-4 rounded-2xl text-right transition-all flex items-center justify-between group ${selectedItem === type ? 'bg-blue-600/40 border border-blue-500/50 shadow-[0_0_20px_rgba(37,99,235,0.2)]' : 'bg-white/5 border border-transparent hover:bg-white/10'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2.5 rounded-xl ${selectedItem === type ? 'bg-blue-500 shadow-lg' : 'bg-slate-800'}`}>
                        <Compass className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-sm font-bold">{type}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <p className="text-[10px] font-black text-purple-400 uppercase tracking-[0.2em] mb-4 px-2">رویدادهای عظیم</p>
              <div className="grid grid-cols-1 gap-2">
                {Object.values(CosmicEvent).map((event) => (
                  <button
                    key={event}
                    onClick={() => setSelectedItem(event)}
                    className={`w-full p-4 rounded-2xl text-right transition-all flex items-center justify-between group ${selectedItem === event ? 'bg-purple-600/40 border border-purple-500/50 shadow-[0_0_20px_rgba(147,51,234,0.2)]' : 'bg-white/5 border border-transparent hover:bg-white/10'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2.5 rounded-xl ${selectedItem === event ? 'bg-purple-500 shadow-lg shadow-purple-500/20' : 'bg-slate-800'}`}>
                        {event === CosmicEvent.COLLISION ? <Activity size={20}/> : event === CosmicEvent.SUPERNOVA ? <Flame size={20}/> : <Zap size={20}/>}
                      </div>
                      <span className="text-sm font-bold">{event}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <div className="p-6 bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-white/10 rounded-[2rem] relative overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3 text-blue-300 font-black text-xs uppercase tracking-widest">
                  <Volume2 size={16} className={audioState.isPlaying ? 'animate-pulse' : ''} /> 
                  روایتگر هوشمند
                </div>
                {audioState.duration > 0 && (
                   <span className="text-[10px] font-mono text-blue-300 bg-blue-400/20 px-3 py-1 rounded-full border border-blue-400/20">
                     {formatTime(audioState.currentTime)} / {formatTime(audioState.duration)}
                   </span>
                )}
              </div>
              
              <p className="text-sm leading-relaxed text-slate-300 mb-8 text-justify font-light italic">
                {GALAXY_INTRODUCTIONS[selectedItem]}
              </p>

              <div className="relative h-2 w-full bg-slate-900 rounded-full mb-8 overflow-hidden border border-white/5">
                <div 
                  className="absolute top-0 right-0 h-full bg-gradient-to-l from-blue-400 via-indigo-500 to-purple-600 shadow-[0_0_15px_rgba(59,130,246,0.6)] transition-all duration-100 ease-linear"
                  style={{ width: `${audioState.progress}%` }}
                />
              </div>

              <div className="flex items-center justify-center gap-6">
                <button 
                  onClick={stopAudio}
                  className="p-4 bg-slate-900/80 hover:bg-slate-800 rounded-2xl border border-white/10 transition-all active:scale-90"
                  title="توقف"
                >
                  <Square size={18} className="fill-current text-slate-400" />
                </button>
                
                <button 
                  onClick={togglePlayPause}
                  disabled={isGeneratingAudio}
                  className={`p-6 rounded-[1.5rem] shadow-2xl transition-all active:scale-95 flex items-center justify-center ${
                    audioState.isPlaying 
                    ? 'bg-purple-600 hover:bg-purple-500' 
                    : 'bg-blue-600 hover:bg-blue-500'
                  }`}
                  title={audioState.isPlaying ? "توقف موقت" : "پخش روایت صوتی"}
                >
                  {audioState.isPlaying ? (
                    <Pause size={28} className="fill-current text-white" />
                  ) : (
                    <Play size={28} className="fill-current text-white translate-x-1" />
                  )}
                </button>

                <button 
                  onClick={() => handleLoadAudio(selectedItem)}
                  disabled={isGeneratingAudio}
                  className="p-4 bg-slate-900/80 hover:bg-slate-800 rounded-2xl border border-white/10 transition-all active:scale-90"
                  title="تولید مجدد صوت"
                >
                  <RotateCcw size={18} className="text-slate-400" />
                </button>
              </div>

              {isGeneratingAudio && (
                <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center gap-4 z-20">
                  <div className="relative">
                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                    <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-purple-400 animate-pulse" />
                  </div>
                  <span className="text-[10px] font-black text-blue-400 tracking-[0.3em] uppercase">در حال تولید روایت صوتی...</span>
                </div>
              )}
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col p-12 justify-start items-start relative">
          <div className="text-right">
            <h2 className="text-7xl font-black text-white/95 uppercase tracking-tighter drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] leading-none mb-4">{selectedItem}</h2>
            <div className="h-2 w-48 bg-gradient-to-l from-blue-500 via-indigo-500 to-transparent rounded-full shadow-[0_0_20px_rgba(59,130,246,0.5)]" />
          </div>
        </main>
      </div>

      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_transparent_0%,_#020617_100%)] z-[1]" />
    </div>
  );
};

export default App;
