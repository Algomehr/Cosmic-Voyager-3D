
import React, { useState, useEffect, useRef } from 'react';
import { 
  Telescope, 
  Send, 
  Mic, 
  MicOff, 
  MessageSquare, 
  ChevronRight, 
  ChevronLeft,
  Compass,
  Sparkles,
  Info,
  Loader2,
  Play,
  Pause,
  Square,
  Rocket,
  Zap,
  Flame,
  Activity,
  Volume2,
  RotateCcw
} from 'lucide-react';
import { marked } from 'marked';
import GalaxyScene from './components/GalaxyScene';
import { GalaxyType, CosmicEvent, Message } from './types';
import { GALAXY_CONFIGS, GALAXY_INTRODUCTIONS, APP_INTRODUCTION } from './constants';
import { GeminiService } from './services/geminiService';

const gemini = new GeminiService();

// Helper Component for Markdown & LaTeX Rendering
const FormattedMessage: React.FC<{ content: string }> = ({ content }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      // 1. Process LaTeX before markdown
      // Matches both $...$ and $$...$$
      let processedContent = content.replace(/\$\$([\s\S]+?)\$\$/g, (match, formula) => {
        try {
          return (window as any).katex.renderToString(formula, { displayMode: true, throwOnError: false });
        } catch (e) { return match; }
      });

      processedContent = processedContent.replace(/\$([\s\S]+?)\$/g, (match, formula) => {
        try {
          return (window as any).katex.renderToString(formula, { displayMode: false, throwOnError: false });
        } catch (e) { return match; }
      });

      // 2. Process Markdown
      const htmlContent = marked.parse(processedContent);
      containerRef.current.innerHTML = htmlContent as string;
    }
  }, [content]);

  return <div ref={containerRef} className="prose-content text-[11px] leading-relaxed" />;
};

const App: React.FC = () => {
  const [selectedItem, setSelectedItem] = useState<GalaxyType | CosmicEvent>(GalaxyType.SPIRAL);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: 'درود بر شما کاوشگر گرامی! من دستیار کیهانی شما هستم. آماده‌ام تا در سفر میان کهکشان‌ها همراهتان باشم. چه سوالی دارید؟', timestamp: new Date() }
  ]);
  const [inputText, setInputText] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  
  // Audio Player State
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

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (!showWelcome) {
      handleLoadAudio(selectedItem);
    }
    return () => stopAudio();
  }, [selectedItem, showWelcome]);

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
    setAudioState(prev => ({ ...prev, isPlaying: false, progress: 0, currentTime: 0 }));
  };

  const handleLoadAudio = async (type: string) => {
    stopAudio();
    
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
      if (Math.abs(audioState.currentTime - currentBufferRef.current!.duration) < 0.2) {
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

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim()) return;

    const userMessage: Message = { role: 'user', text: inputText, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    try {
      const response = await gemini.sendTextMessage(inputText, selectedItem, messages);
      setMessages(prev => [...prev, { role: 'ai', text: response || 'متاسفم، مشکلی پیش آمد.', timestamp: new Date() }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: 'خطا در ارتباط با هوش مصنوعی.', timestamp: new Date() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const toggleLiveVoice = async () => {
    if (isLiveActive) { window.location.reload(); return; }
    try {
      setIsLiveActive(true);
      await gemini.connectVoice(selectedItem, {
        onMessage: (text, isUser) => {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === (isUser ? 'user' : 'ai') && Date.now() - last.timestamp.getTime() < 3000) {
              const updated = [...prev];
              updated[updated.length - 1] = { ...last, text: last.text + ' ' + text };
              return updated;
            }
            return [...prev, { role: isUser ? 'user' : 'ai', text, timestamp: new Date() }];
          });
        },
        onError: () => setIsLiveActive(false)
      });
    } catch (err) { setIsLiveActive(false); }
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
                آغاز سفر در زمان و فضا
                <ChevronLeft className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`absolute inset-0 z-10 pointer-events-none flex flex-row-reverse transition-opacity duration-1000 ${showWelcome ? 'opacity-0' : 'opacity-100'}`}>
        
        <aside className={`pointer-events-auto h-full bg-slate-900/40 backdrop-blur-xl border-l border-white/10 transition-all duration-500 flex flex-col ${isSidebarOpen ? 'w-80' : 'w-0 overflow-hidden'}`}>
          <div className="p-6 border-b border-white/10">
            <h1 className="text-xl font-bold flex items-center gap-3 text-blue-400">
              <Telescope className="w-6 h-6" />
              کاوشگر کیهانی
            </h1>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <section>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 px-2">انواع کهکشان‌ها</p>
              <div className="space-y-2">
                {Object.values(GalaxyType).map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedItem(type)}
                    className={`w-full p-3 rounded-xl text-right transition-all flex items-center justify-between group ${selectedItem === type ? 'bg-blue-600/30 border border-blue-500/50' : 'bg-white/5 border border-transparent hover:bg-white/10'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${selectedItem === type ? 'bg-blue-500 shadow-lg' : 'bg-slate-700'}`}>
                        <Compass className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm font-semibold">{type}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section>
              <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-3 px-2">رویدادهای عظیم کیهانی</p>
              <div className="space-y-2">
                {Object.values(CosmicEvent).map((event) => (
                  <button
                    key={event}
                    onClick={() => setSelectedItem(event)}
                    className={`w-full p-3 rounded-xl text-right transition-all flex items-center justify-between group ${selectedItem === event ? 'bg-purple-600/30 border border-purple-500/50 shadow-lg' : 'bg-white/5 border border-transparent hover:bg-white/10'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${selectedItem === event ? 'bg-purple-500 shadow-lg shadow-purple-500/20' : 'bg-slate-700'}`}>
                        {event === CosmicEvent.COLLISION ? <Activity size={16}/> : event === CosmicEvent.SUPERNOVA ? <Flame size={16}/> : <Zap size={16}/>}
                      </div>
                      <span className="text-sm font-semibold">{event}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Audio Player UI */}
            <div className="p-5 bg-blue-500/10 border border-blue-500/20 rounded-3xl relative overflow-hidden shadow-xl group">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-blue-300 font-bold text-[10px] uppercase tracking-tighter">
                  <Volume2 size={14} className={audioState.isPlaying ? 'animate-pulse' : ''} /> شناسنامه صوتی پدیده
                </div>
                {audioState.duration > 0 && (
                   <span className="text-[9px] font-mono text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">
                     {formatTime(audioState.currentTime)} / {formatTime(audioState.duration)}
                   </span>
                )}
              </div>
              
              <p className="text-[11px] leading-relaxed text-slate-300 mb-6 text-justify">
                {GALAXY_INTRODUCTIONS[selectedItem]}
              </p>

              <div className="relative h-1.5 w-full bg-slate-800 rounded-full mb-6 overflow-hidden">
                <div 
                  className="absolute top-0 right-0 h-full bg-gradient-to-l from-blue-400 to-purple-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-100 ease-linear"
                  style={{ width: `${audioState.progress}%` }}
                />
              </div>

              <div className="flex items-center justify-center gap-4">
                <button 
                  onClick={stopAudio}
                  className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-white/5 transition-all active:scale-90"
                  title="توقف"
                >
                  <Square size={16} className="fill-current text-slate-400" />
                </button>
                
                <button 
                  onClick={togglePlayPause}
                  disabled={isGeneratingAudio}
                  className={`p-5 rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center ${
                    audioState.isPlaying 
                    ? 'bg-purple-600 hover:bg-purple-500' 
                    : 'bg-blue-600 hover:bg-blue-500'
                  }`}
                >
                  {audioState.isPlaying ? (
                    <Pause size={24} className="fill-current text-white" />
                  ) : (
                    <Play size={24} className="fill-current text-white translate-x-0.5" />
                  )}
                </button>

                <button 
                  onClick={() => handleLoadAudio(selectedItem)}
                  className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl border border-white/5 transition-all active:scale-90"
                  title="پخش مجدد"
                >
                  <RotateCcw size={16} className="text-slate-400" />
                </button>
              </div>

              {isGeneratingAudio && (
                <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center gap-3 z-20">
                  <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                  <span className="text-[10px] font-bold text-blue-300 tracking-widest uppercase">دریافت سیگنال‌های کیهانی...</span>
                </div>
              )}
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col p-6 justify-end items-start relative">
          <div className="absolute top-10 right-10 text-right">
            <h2 className="text-5xl font-black text-white/90 uppercase tracking-tighter drop-shadow-2xl">{selectedItem}</h2>
            <div className="mt-2 h-1.5 w-24 bg-gradient-to-l from-blue-500 to-transparent rounded-full shadow-lg shadow-blue-500/50" />
          </div>

          <div className="pointer-events-auto w-full max-w-lg bg-slate-950/70 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col h-[500px]">
            <div className="p-4 bg-white/5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg"><MessageSquare size={20} /></div>
                <div><h3 className="font-bold text-sm text-slate-200">دستیار کیهانی</h3><p className="text-[9px] text-green-400 font-bold uppercase tracking-widest">Live Syncing</p></div>
              </div>
              <button onClick={toggleLiveVoice} className={`p-3 rounded-2xl transition-all ${isLiveActive ? 'bg-red-500 animate-pulse' : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20'}`}>
                {isLiveActive ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[85%] p-4 rounded-3xl shadow-sm ${msg.role === 'user' ? 'bg-white/10 rounded-tr-none border border-white/5' : 'bg-blue-600 rounded-tl-none shadow-lg shadow-blue-600/10'}`}>
                    {msg.role === 'ai' ? (
                      <FormattedMessage content={msg.text} />
                    ) : (
                      <div className="text-[11px] leading-relaxed">{msg.text}</div>
                    )}
                  </div>
                </div>
              ))}
              {isTyping && <div className="flex justify-end"><div className="bg-blue-600/30 px-4 py-3 rounded-3xl flex gap-1"><div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce"/><div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:0.2s]"/><div className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:0.4s]"/></div></div>}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-4 bg-slate-900/80 border-t border-white/10 flex gap-2">
              <input type="text" value={inputText} onChange={e => setInputText(e.target.value)} placeholder="سوال خود را اینجا بنویسید..." className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-3.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-all" />
              <button type="submit" className="bg-blue-600 p-3.5 rounded-2xl hover:bg-blue-700 transition-all shadow-lg active:scale-95"><Send size={22} className="rotate-180" /></button>
            </form>
          </div>
        </main>
      </div>

      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,_transparent_0%,_#020617_100%)] z-[1]" />
    </div>
  );
};

export default App;
