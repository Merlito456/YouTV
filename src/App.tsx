import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './lib/supabase';
import { Channel, Program } from './types';
import { ChevronUp, ChevronDown, Info, Settings, Tv, Play, SkipForward, List } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import AdminPanel from './components/AdminPanel';
import { cn } from './lib/utils';

const ADMIN_PASSWORD = '07141994';

const MOCK_CHANNELS: Channel[] = [
  { id: '1', name: 'LOFI RADIO', query: 'lofi hip hop radio', is_live: true, live_video_id: 'jfKfPfyJRdk' },
  { id: '2', name: 'TECH NEWS', query: 'tech news daily', is_live: false, playlist_id: 'PL7u4lWXQ3wfI_7PgX0C-JDpuEtPdZSiz3' },
  { id: '3', name: 'NATURE TV', query: '4k nature relaxation', is_live: false },
  { id: '4', name: 'COMEDY CENTRAL', query: 'stand up comedy full specials', is_live: false },
  { id: '5', name: 'SPACE EXPLORER', query: 'nasa live stream', is_live: true, live_video_id: '21X5lGlDOfg' },
];

export default function App() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [showOverlay, setShowOverlay] = useState(true);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [randomProgram, setRandomProgram] = useState<Program | null>(null);
  const overlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchChannels = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .order('created_at', { ascending: true });

      if (error || !data || data.length === 0) {
        console.log('Using mock channels');
        setChannels(MOCK_CHANNELS);
      } else {
        setChannels(data);
      }
    } catch (err) {
      setChannels(MOCK_CHANNELS);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const currentChannel = channels[currentIndex];
  const now = new Date();
  const currentProgram = programs.find(p => new Date(p.start_time) <= now && new Date(p.end_time) >= now);
  const nextProgram = programs.find(p => new Date(p.start_time) > now);

  useEffect(() => {
    if (channels.length > 0) {
      fetchPrograms(channels[currentIndex].id);
      triggerOverlay();
    }
  }, [currentIndex, channels]);

  useEffect(() => {
    if (programs.length > 0 && !currentProgram) {
      const randomIndex = Math.floor(Math.random() * programs.length);
      setRandomProgram(programs[randomIndex]);
    } else {
      setRandomProgram(null);
    }
  }, [programs, currentProgram]);

  const fetchPrograms = async (channelId: string) => {
    const { data, error } = await supabase
      .from('programs')
      .select('*')
      .eq('channel_id', channelId)
      .order('start_time', { ascending: true });

    if (!error && data) {
      setPrograms(data);
    } else {
      // Mock programs for the current channel
      const now = new Date();
      const mockPrograms: Program[] = [
        {
          id: 'p1',
          channel_id: channelId,
          title: `${channels[currentIndex]?.name} Morning Show`,
          start_time: new Date(now.getTime() - 3600000).toISOString(),
          end_time: new Date(now.getTime() + 3600000).toISOString(),
        },
        {
          id: 'p2',
          channel_id: channelId,
          title: `${channels[currentIndex]?.name} Special Feature`,
          start_time: new Date(now.getTime() + 3600000).toISOString(),
          end_time: new Date(now.getTime() + 7200000).toISOString(),
        }
      ];
      setPrograms(mockPrograms);
    }
  };

  const triggerOverlay = () => {
    setShowOverlay(true);
    if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
    overlayTimeoutRef.current = setTimeout(() => {
      setShowOverlay(false);
    }, 5000);
  };

  const nextChannel = () => {
    setCurrentIndex((prev) => (prev + 1) % channels.length);
  };

  const prevChannel = () => {
    setCurrentIndex((prev) => (prev - 1 + channels.length) % channels.length);
  };

  const getEmbedUrl = (channel: Channel, program?: Program) => {
    if (!channel) return '';
    let baseUrl = 'https://www.youtube.com/embed/';
    // Added mute=1 for more reliable autoplay across browsers
    let params = '?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&enablejsapi=1';

    const activeProgram = program || randomProgram;

    // Priority 1: Current/Random Program's Video ID
    if (activeProgram?.video_id) {
      return `${baseUrl}${activeProgram.video_id}${params}`;
    }

    // Priority 2: Channel Live Stream
    if (channel.is_live && channel.live_video_id) {
      return `${baseUrl}${channel.live_video_id}${params}`;
    } 
    
    // Priority 3: Channel Playlist
    if (channel.playlist_id) {
      return `${baseUrl}videoseries?list=${channel.playlist_id}${params}`;
    } 
    
    // Priority 4: Search Query
    if (channel.query) {
      return `${baseUrl}?listType=search&list=${encodeURIComponent(channel.query)}${params}`;
    }
    return '';
  };

  const embedUrl = currentChannel ? getEmbedUrl(currentChannel, currentProgram) : '';

  const handleAdminAccess = () => {
    if (password === ADMIN_PASSWORD) {
      setIsAdminOpen(true);
      setShowPasswordPrompt(false);
      setPassword('');
    } else {
      alert('Incorrect password');
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Tv className="w-16 h-16 text-indigo-500 animate-pulse" />
          <p className="text-zinc-500 font-mono tracking-widest uppercase text-sm">Initializing YOUTV...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black overflow-hidden relative group font-sans">
      {/* Video Player Background */}
      <div className="absolute inset-0 pointer-events-none bg-black flex items-center justify-center">
        {embedUrl && (
          <iframe
            key={`${currentChannel?.id}-${currentProgram?.id}`}
            src={embedUrl}
            className="w-full h-full aspect-video"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        )}
      </div>

      {/* Interaction Layer */}
      <div 
        className="absolute inset-0 z-10 cursor-pointer" 
        onClick={triggerOverlay} 
        onMouseMove={triggerOverlay}
        onTouchStart={triggerOverlay}
      />

      {/* UI Overlay */}
      <AnimatePresence>
        {showOverlay && (
          <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between p-4 sm:p-10">
            {/* Top Section: Channel Info & Admin */}
            <div className="flex justify-between items-start w-full">
              <motion.div 
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -50, opacity: 0 }}
                className="pointer-events-auto"
              >
                <div className="flex items-center gap-3 sm:gap-4 bg-black/40 backdrop-blur-xl p-3 sm:p-4 rounded-2xl border border-white/10 shadow-2xl">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-indigo-600 rounded-xl flex items-center justify-center text-xl sm:text-3xl font-black text-white shadow-lg shadow-indigo-600/30">
                    {currentIndex + 1}
                  </div>
                  <div>
                    <h1 className="text-lg sm:text-2xl font-black text-white tracking-tight uppercase truncate max-w-[150px] sm:max-w-none">
                      {currentChannel?.name}
                    </h1>
                    <p className="text-indigo-400 text-[10px] sm:text-xs font-bold tracking-widest uppercase">
                      Channel {currentIndex + 1}
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                initial={{ x: 50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 50, opacity: 0 }}
                className="pointer-events-auto"
              >
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowPasswordPrompt(true); }}
                  className="p-3 sm:p-4 bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 hover:bg-white/10 transition-all text-white/50 hover:text-white"
                >
                  <Settings className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </motion.div>
            </div>

            {/* Middle Section: Mobile Navigation Arrows (Visible only on small screens) */}
            <div className="sm:hidden flex flex-col gap-4 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-auto">
              <button 
                onClick={(e) => { e.stopPropagation(); prevChannel(); }}
                className="w-12 h-12 bg-black/40 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 text-white"
              >
                <ChevronUp className="w-6 h-6" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); nextChannel(); }}
                className="w-12 h-12 bg-black/40 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 text-white"
              >
                <ChevronDown className="w-6 h-6" />
              </button>
            </div>

            {/* Bottom Section: EPG & Controls */}
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="w-full pointer-events-auto"
            >
              <div className="bg-black/40 backdrop-blur-2xl p-5 sm:p-8 rounded-3xl border border-white/10 shadow-2xl flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                <div className="space-y-2 sm:space-y-4 max-w-2xl">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold text-[10px] sm:text-xs tracking-[0.2em] uppercase">
                    <Play className="w-3 h-3 fill-current" /> Now Playing
                  </div>
                  <h2 className="text-2xl sm:text-4xl font-black text-white leading-tight">
                    {currentProgram?.title || randomProgram?.title || 'Continuous Stream'}
                  </h2>
                  {(nextProgram || currentProgram?.description) && (
                    <div className="flex flex-col gap-2 pt-1 sm:pt-2">
                      {currentProgram?.description && (
                        <p className="text-zinc-400 text-xs sm:text-sm line-clamp-2 sm:line-clamp-1 max-w-xl italic">
                          {currentProgram.description}
                        </p>
                      )}
                      {nextProgram && (
                        <div className="flex items-center gap-3">
                          <div className="px-2 py-0.5 bg-white/10 text-zinc-400 text-[8px] sm:text-[10px] font-bold rounded uppercase tracking-wider">Up Next</div>
                          <p className="text-zinc-400 text-xs sm:text-base font-medium truncate">{nextProgram.title}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 sm:gap-4 self-end sm:self-auto">
                  <button 
                    onClick={(e) => { e.stopPropagation(); prevChannel(); }}
                    className="w-12 h-12 sm:w-16 sm:h-16 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center transition-all border border-white/5 group/btn hidden sm:flex"
                  >
                    <ChevronUp className="w-6 h-6 sm:w-8 sm:h-8 text-white group-hover/btn:scale-110 transition-transform" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); nextChannel(); }}
                    className="w-12 h-12 sm:w-16 sm:h-16 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center transition-all border border-white/5 group/btn hidden sm:flex"
                  >
                    <ChevronDown className="w-6 h-6 sm:w-8 sm:h-8 text-white group-hover/btn:scale-110 transition-transform" />
                  </button>
                  
                  {/* Channel Guide Button (Cable TV Feel) */}
                  <div className="flex items-center gap-2 px-4 py-2 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-indigo-300 text-[10px] font-black uppercase tracking-widest">
                    <List className="w-4 h-4" /> Guide
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Password Prompt Modal */}
      <AnimatePresence>
        {showPasswordPrompt && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4"
          >
            <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-3xl p-8 shadow-2xl">
              <div className="flex flex-col items-center text-center mb-8">
                <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-4">
                  <Settings className="w-8 h-8 text-indigo-500" />
                </div>
                <h2 className="text-2xl font-bold text-white">Admin Access</h2>
                <p className="text-zinc-500 text-sm mt-2">Enter the system password to manage channels</p>
              </div>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdminAccess()}
                placeholder="••••••••"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-6 py-4 text-white text-center text-2xl tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-6"
                autoFocus
              />
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowPasswordPrompt(false)}
                  className="flex-1 py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAdminAccess}
                  className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-indigo-600/20"
                >
                  Unlock
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin Panel Modal */}
      <AnimatePresence>
        {isAdminOpen && (
          <AdminPanel 
            onClose={() => {
              setIsAdminOpen(false);
              fetchChannels();
            }} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
