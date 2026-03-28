import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from './lib/supabase';
import { Channel, Program, ScheduledProgram } from './types';
import { cn } from './lib/utils';
import { format, isWithinInterval } from 'date-fns';
import { YouTubeCompliantAd } from './components/Ads/YouTubeCompliantAd';
import { useVideoResize } from './hooks/useVideoResize';
import { detectLiveVideoIds, fetchPlaylistVideos, searchVideos, getVideoDetails, getBatchVideoDetails, isVideoLive, getNoApiVideoDetails, getNoApiPlaylistVideos } from './services/youtubeService';
import { 
  Tv, 
  Settings, 
  Play, 
  Plus, 
  Trash2, 
  X, 
  Calendar, 
  Clock, 
  Info, 
  LogOut, 
  LogIn,
  ChevronRight,
  MonitorPlay,
  Activity,
  Volume2,
  VolumeX,
  RefreshCw,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Admin Password ---
const ADMIN_PASSWORD = '07141994';
const IS_PLAY_STORE_BUILD = true;

// --- YouTube Player Hook ---
declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [currentProgram, setCurrentProgram] = useState<ScheduledProgram | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [player, setPlayer] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isZapping, setIsZapping] = useState(false);
  const [showChannelList, setShowChannelList] = useState(false);
  const [showEPG, setShowEPG] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [volume, setVolume] = useState(50);
  const [isMuted, setIsMuted] = useState(false);
  const [showVolumeOverlay, setShowVolumeOverlay] = useState(false);
  const [focusedChannelIndex, setFocusedChannelIndex] = useState(0);
  const [focusedProgramIndex, setFocusedProgramIndex] = useState(0);
  const [focusedAdminIndex, setFocusedAdminIndex] = useState(-1);
  const [showChannelNumber, setShowChannelNumber] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showComplianceModal, setShowComplianceModal] = useState(false);
  const [complianceType, setComplianceType] = useState<'privacy' | 'terms' | 'deletion' | 'report'>('privacy');
  const [isAgeVerified, setIsAgeVerified] = useState<boolean>(() => {
    return localStorage.getItem('ageVerified') === 'true';
  });
  const [showAgeGate, setShowAgeGate] = useState(!isAgeVerified);
  const [showParentalControls, setShowParentalControls] = useState(false);
  const [parentalPin, setParentalPin] = useState<string>(() => {
    return localStorage.getItem('parentalPin') || '1234';
  });
  const [restrictedChannels, setRestrictedChannels] = useState<string[]>(() => {
    return JSON.parse(localStorage.getItem('restrictedChannels') || '[]');
  });
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  
  const {
    containerRef,
    adContainerRef,
    showAd,
    adType,
    showSidebarAd: triggerSidebarAd,
    showCornerAdTimed,
    hideAd
  } = useVideoResize({
    defaultWidth: '100%',
    adWidth: 'calc(100% - 340px)',
    transitionDuration: 300
  });

  const [showSidebarAd, setShowSidebarAd] = useState(false);
  const [showCornerAd, setShowCornerAd] = useState(false);

  // Show corner ad every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      setShowCornerAd(true);
      showCornerAdTimed(8000);
      setTimeout(() => {
        setShowCornerAd(false);
      }, 8000);
    }, 300000);

    return () => clearInterval(interval);
  }, [showCornerAdTimed]);

  const overlayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const volumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelNumberTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const channelListRef = useRef<HTMLDivElement>(null);
  const epgRef = useRef<HTMLDivElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const adminPanelRef = useRef<HTMLDivElement>(null);

  const parseISO8601Duration = (duration: string): number => {
    const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
    const matches = duration.match(regex);
    if (!matches) return 600; // 10 mins default

    const hours = parseInt(matches[1] || '0');
    const minutes = parseInt(matches[2] || '0');
    const seconds = parseInt(matches[3] || '0');

    return hours * 3600 + minutes * 60 + seconds;
  };

  const calculateStartTime = (startTime: Date, title?: string) => {
    if (title === "LIVE BROADCAST") return 0;
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
    return Math.max(0, diffSeconds);
  };

  useEffect(() => {
    if (showChannelList && channelListRef.current) {
      const focusedElement = channelListRef.current.children[focusedChannelIndex] as HTMLElement;
      if (focusedElement) {
        focusedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [focusedChannelIndex, showChannelList]);

  useEffect(() => {
    if (showEPG && epgRef.current) {
      const focusedElement = epgRef.current.children[focusedChannelIndex] as HTMLElement;
      if (focusedElement) {
        focusedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [focusedChannelIndex, showEPG]);

  useEffect(() => {
    if (showPasswordModal && passwordInputRef.current) {
      passwordInputRef.current.focus();
    }
  }, [showPasswordModal]);

  useEffect(() => {
    if (showAdminPanel && adminPanelRef.current) {
      // Find the focused section based on index
      // 0: Add Channel, 1: Manage Content (left), 2: Add Program, 3: Manage Content (right)
      // Actually, my mapping was a bit different. Let's just scroll to the section.
      const sections = adminPanelRef.current.querySelectorAll('section');
      const focusedSection = sections[focusedAdminIndex];
      if (focusedSection) {
        focusedSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [focusedAdminIndex, showAdminPanel]);

  // --- Auth Setup ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // --- Keyboard & Remote Navigation ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!hasInteracted) {
        setHasInteracted(true);
        if (player && player.playVideo) {
          player.playVideo();
          player.unMute();
          setIsMuted(false);
        }
        return;
      }

      if (isMuted && player) {
        player.unMute();
        setIsMuted(false);
      }

      // Handle Back/Escape
      if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'GoBack') {
        if (showAdminPanel) {
          setShowAdminPanel(false);
          return;
        }
        if (showEPG) {
          setShowEPG(false);
          return;
        }
        if (showChannelList) {
          setShowChannelList(false);
          return;
        }
        if (showPasswordModal) {
          setShowPasswordModal(false);
          return;
        }
      }

      // Admin Panel Navigation
      if (showAdminPanel) {
        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault();
            setFocusedAdminIndex(prev => (prev > 0 ? prev - 1 : 3));
            break;
          case 'ArrowDown':
            e.preventDefault();
            setFocusedAdminIndex(prev => (prev < 3 ? prev + 1 : 0));
            break;
        }
        return;
      }

      // Channel List Navigation
      if (showChannelList) {
        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault();
            setFocusedChannelIndex(prev => (prev > 0 ? prev - 1 : channels.length - 1));
            break;
          case 'ArrowDown':
            e.preventDefault();
            setFocusedChannelIndex(prev => (prev < channels.length - 1 ? prev + 1 : 0));
            break;
          case 'Enter':
          case 'OK':
          case 'Select':
            e.preventDefault();
            handleChannelChange(channels[focusedChannelIndex]);
            break;
        }
        return;
      }

      // EPG Navigation
      if (showEPG) {
        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault();
            setFocusedChannelIndex(prev => (prev > 0 ? prev - 1 : channels.length - 1));
            break;
          case 'ArrowDown':
            e.preventDefault();
            setFocusedChannelIndex(prev => (prev < channels.length - 1 ? prev + 1 : 0));
            break;
          case 'ArrowLeft':
            e.preventDefault();
            // Could navigate programs here
            break;
          case 'ArrowRight':
            e.preventDefault();
            // Could navigate programs here
            break;
          case 'Enter':
          case 'OK':
          case 'Select':
            e.preventDefault();
            handleChannelChange(channels[focusedChannelIndex]);
            setShowEPG(false);
            break;
        }
        return;
      }

      // Password Modal
      if (showPasswordModal) {
        if (e.key === 'Enter' || e.key === 'OK' || e.key === 'Select') {
          // If focus is on input, verifyPassword is handled by input's onKeyDown
          // But for remote, we might need to trigger it explicitly if focus is lost
          if (document.activeElement?.tagName !== 'INPUT') {
            verifyPassword();
          }
        }
        return;
      }

      // Global Navigation
      switch (e.key) {
        case 'ArrowUp':
        case 'ChannelUp':
          e.preventDefault();
          switchChannel('prev');
          break;
        case 'ArrowDown':
        case 'ChannelDown':
          e.preventDefault();
          switchChannel('next');
          break;
        case 'ArrowLeft':
        case 'VolumeDown':
          e.preventDefault();
          adjustVolume(-5);
          break;
        case 'ArrowRight':
        case 'VolumeUp':
          e.preventDefault();
          adjustVolume(5);
          break;
        case 'Enter':
        case 'OK':
        case 'Select':
          setShowOverlay(true);
          break;
        case 'm':
        case 'M':
        case 'VolumeMute':
          toggleMute();
          break;
        case 'g':
        case 'G':
        case 'Guide':
          setShowEPG(prev => !prev);
          if (!showEPG) setFocusedChannelIndex(channels.indexOf(currentChannel || channels[0]));
          break;
        case 'c':
        case 'C':
        case 'ChannelList':
          setShowChannelList(prev => !prev);
          if (!showChannelList) setFocusedChannelIndex(channels.indexOf(currentChannel || channels[0]));
          break;
        case 'MediaPlayPause':
          if (player) {
            const state = player.getPlayerState();
            if (state === 1) player.pauseVideo();
            else player.playVideo();
          }
          break;
        case 'MediaPlay':
          if (player) player.playVideo();
          break;
        case 'MediaPause':
          if (player) player.pauseVideo();
          break;
        case 'MediaStop':
          if (player) player.stopVideo();
          break;
        case '1': case '2': case '3': case '4': case '5':
        case '6': case '7': case '8': case '9': case '0':
          // Direct channel entry could be implemented here
          const num = parseInt(e.key);
          if (num > 0 && num <= channels.length) {
            handleChannelChange(channels[num - 1]);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [channels, currentChannel, showAdminPanel, showEPG, showChannelList, showPasswordModal, player, isMuted, volume, hasInteracted, focusedChannelIndex]);

  const switchChannel = (direction: 'next' | 'prev') => {
    if (channels.length === 0) return;
    const currentIndex = currentChannel ? channels.indexOf(currentChannel) : 0;
    let nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    
    if (nextIndex >= channels.length) nextIndex = 0;
    if (nextIndex < 0) nextIndex = channels.length - 1;
    
    handleChannelChange(channels[nextIndex]);
  };

  const adjustVolume = (delta: number) => {
    if (!player) return;
    const newVolume = Math.min(100, Math.max(0, volume + delta));
    setVolume(newVolume);
    player.setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      player.unMute();
      setIsMuted(false);
    }
    setShowVolumeOverlay(true);
    if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    volumeTimeoutRef.current = setTimeout(() => setShowVolumeOverlay(false), 2000);
  };

  const toggleMute = () => {
    if (!player) return;
    if (isMuted) {
      player.unMute();
      setIsMuted(false);
    } else {
      player.mute();
      setIsMuted(true);
    }
    setShowVolumeOverlay(true);
    if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    volumeTimeoutRef.current = setTimeout(() => setShowVolumeOverlay(false), 2000);
  };

  // --- YouTube API Loading ---
  useEffect(() => {
    const initPlayer = () => {
      if (window.YT && window.YT.Player) {
        new window.YT.Player('youtube-player', {
          height: '100%',
          width: '100%',
          playerVars: {
            autoplay: 1,
            controls: 0,
            rel: 0,
            modestbranding: 1,
            iv_load_policy: 3,
            disablekb: 1,
            showinfo: 0,
            origin: window.location.origin,
            enablejsapi: 1
          },
          events: {
            onReady: (event: any) => {
              setPlayer(event.target);
              event.target.unMute();
              setIsMuted(false);
              event.target.setVolume(volume);
              event.target.playVideo();
            },
            onStateChange: (event: any) => {
              const state = event.data;
              if (state === window.YT.PlayerState.BUFFERING) {
                setIsBuffering(true);
              } else {
                setIsBuffering(false);
              }

              // If video ended, refill EPG and show ad
              if (state === window.YT.PlayerState.ENDED && currentChannel) {
                setShowSidebarAd(true);
                triggerSidebarAd(8000);
                
                setTimeout(() => {
                  setShowSidebarAd(false);
                  syncChannelPrograms(currentChannel);
                }, 8000);
              }

              // If it's paused but we have interacted, try to play
              if (state === window.YT.PlayerState.PAUSED && hasInteracted) {
                event.target.playVideo();
              }
            },
            onError: (event: any) => {
              console.error("YouTube Player Error:", event.data);
              handlePlaybackError(event.data);
            }
          }
        });
      }
    };

    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      window.onYouTubeIframeAPIReady = initPlayer;
    } else {
      initPlayer();
    }
  }, []);

  // --- Data Fetching ---
  useEffect(() => {
    const fetchChannels = async () => {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) {
        setError(error.message);
        return;
      }
      
      const channelsData = data.map(c => ({
        id: c.id,
        name: c.name,
        query: c.query,
        playlist_id: c.playlist_id,
        username: c.username,
        channel_id: c.channel_id,
        is_live: c.is_live || false,
        live_video_id: c.live_video_id,
        created_at: c.created_at
      } as Channel));

      setChannels(channelsData);
      if (channelsData.length > 0 && !currentChannel) {
        setCurrentChannel(channelsData[0]);
      }
    };

    fetchChannels();

    const channelSubscription = supabase
      .channel('public:channels')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channels' }, fetchChannels)
      .subscribe();

    return () => {
      supabase.removeChannel(channelSubscription);
    };
  }, []);

  useEffect(() => {
    if (!currentChannel) return;

    const fetchPrograms = async () => {
      const { data, error } = await supabase
        .from('programs')
        .select('*')
        .eq('channel_id', currentChannel.id)
        .order('created_at', { ascending: true });
      
      if (error) {
        setError(error.message);
        return;
      }

      const programsData = data.map(p => ({
        id: p.id,
        channel_id: p.channel_id,
        title: p.title,
        video_id: p.video_id,
        duration: p.duration,
        description: p.description,
        created_at: p.created_at
      } as Program));

      setPrograms(programsData);
    };

    fetchPrograms();

    const programSubscription = supabase
      .channel(`public:programs:${currentChannel.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'programs',
        filter: `channel_id=eq.${currentChannel.id}`
      }, fetchPrograms)
      .subscribe();

    return () => {
      supabase.removeChannel(programSubscription);
    };
  }, [currentChannel]);

  const scheduledPrograms = useMemo<ScheduledProgram[]>(() => {
    // If channel is live and has a live_video_id, that's the only program
    if (currentChannel?.is_live && currentChannel?.live_video_id) {
      const now = new Date();
      return [{
        id: 'live-' + currentChannel.id,
        channel_id: currentChannel.id,
        title: 'LIVE BROADCAST',
        video_id: currentChannel.live_video_id,
        duration: 86400, // 24 hours
        start: new Date(now.getTime() - 12 * 60 * 60 * 1000), // Start 12 hours ago
        end: new Date(now.getTime() + 12 * 60 * 60 * 1000), // End 12 hours from now
        created_at: new Date().toISOString()
      }];
    }

    if (programs.length === 0) return [];
    const sorted = [...programs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    let lastEndTime = new Date(sorted[0].created_at);
    return sorted.map(p => {
      const start = lastEndTime;
      const end = new Date(start.getTime() + p.duration * 1000);
      lastEndTime = end;
      return { ...p, start, end };
    });
  }, [programs, currentChannel]);

  // --- EPG Logic ---
  useEffect(() => {
    const interval = setInterval(() => {
      if (scheduledPrograms.length === 0) return;
      
      const now = new Date();
      const active = scheduledPrograms.find(p => isWithinInterval(now, { start: p.start, end: p.end }));
      
      if (active) {
        if (active.id !== currentProgram?.id) {
          setCurrentProgram(active);
          if (player && player.loadVideoById && hasInteracted) {
            console.log("Loading new program:", active.title, "Video ID:", active.video_id);
            player.loadVideoById({
              videoId: active.video_id,
              startSeconds: calculateStartTime(active.start, active.title)
            });
            if (!isMuted) {
              player.unMute();
            } else {
              player.mute();
            }
            player.playVideo();
          }
        } else if (player && player.getPlayerState && hasInteracted) {
          const state = player.getPlayerState();
          // If player is ready but unstarted, or paused, or buffering for too long
          if (state === -1 || state === 5 || state === 2) {
            player.playVideo();
          }
        }
      } else if (!active && currentProgram !== null) {
        setCurrentProgram(null);
        if (player && player.stopVideo) {
          player.stopVideo();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [scheduledPrograms, currentProgram, player, hasInteracted, isMuted]);

  // --- Periodic Live Sync ---
  useEffect(() => {
    // Sync every 15 minutes
    const interval = setInterval(() => {
      syncLiveStatus();
    }, 15 * 60 * 1000);

    // Initial sync after 2 seconds to let data load
    const timeout = setTimeout(() => {
      syncLiveStatus();
    }, 2000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []); // Empty dependency array to prevent infinite loops

  useEffect(() => {
    if (hasInteracted && !currentProgram && scheduledPrograms.length > 0) {
      const now = new Date();
      const active = scheduledPrograms.find(p => isWithinInterval(now, { start: p.start, end: p.end }));
      if (active) {
        setCurrentProgram(active);
        if (player && player.loadVideoById) {
          player.loadVideoById({
            videoId: active.video_id,
            startSeconds: calculateStartTime(active.start, active.title)
          });
          if (!isMuted) {
            player.unMute();
          } else {
            player.mute();
          }
          player.playVideo();
        }
      }
    }
  }, [hasInteracted, scheduledPrograms, player]);

  // --- Overlay Visibility on Interaction ---
  useEffect(() => {
    if (hasInteracted) {
      setShowOverlay(true);
    }
  }, [hasInteracted]);

  // --- Overlay Visibility on Channel Change ---
  useEffect(() => {
    if (currentChannel) {
      setShowOverlay(true);
    }
  }, [currentChannel?.id]);

  // --- Hidden Admin Mode ---
  useEffect(() => {
    let tapCount = 0;
    let lastTap = 0;
    let touchTimer: NodeJS.Timeout;
    let konami: string[] = [];

    const handleTrigger = () => {
      handleAdminAuth();
    };

    const handleTap = () => {
      const now = Date.now();
      if (now - lastTap < 500) {
        tapCount++;
      } else {
        tapCount = 1;
      }
      lastTap = now;
      
      if (tapCount >= 5) {
        handleTrigger();
        tapCount = 0;
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 3) {
        touchTimer = setTimeout(() => {
          handleTrigger();
        }, 2000);
      }
    };

    const handleTouchEnd = () => {
      clearTimeout(touchTimer);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Method 1: Ctrl + Shift + A
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        handleTrigger();
      }
      
      // Method 2: Konami Code (Up Up Down Down Left Right Left Right B A)
      konami.push(e.key);
      konami = konami.slice(-10);
      if (konami.join('').toLowerCase() === 'arrowuparrowuparrowdownarrowdownarrowleftarrowrightarrowleftarrowrightba') {
        handleTrigger();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd);

    // Method 3: Tap Logo 5 times
    const logo = document.querySelector('h1');
    if (logo) logo.addEventListener('click', handleTap);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
      if (logo) logo.removeEventListener('click', handleTap);
    };
  }, [currentChannel]);

  // --- Clock Update ---
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // --- Overlay Timeout ---
  useEffect(() => {
    // Permanent overlay as requested by user
    setShowOverlay(true);
  }, []);

  useEffect(() => {
    if (player && hasInteracted && !isMuted) {
      player.unMute();
      player.setVolume(volume);
    }
  }, [hasInteracted, player, isMuted, volume]);

  const handlePlaybackError = async (errorCode: number) => {
    console.log("Handling playback error:", errorCode);
    
    if (currentProgram) {
      console.log(`Deleting problematic program: ${currentProgram.title} (${currentProgram.video_id})`);
      await deleteProgram(currentProgram.id);
      
      if (currentProgram.title === "LIVE BROADCAST") {
        await supabase.from('channels').update({ live_video_id: null, is_live: false }).eq('id', currentProgram.channel_id);
        setError(`Live stream error. Skipping to next channel...`);
        switchChannel('next');
      } else if (currentChannel && currentProgram) {
        // For non-live, skip to next program by deleting the current one
        // In a duration-based system, deleting the current one shifts the next one forward
        await deleteProgram(currentProgram.id);
        setError(`Video error. Skipping to next program...`);
        syncChannelPrograms(currentChannel);
      }
    } else {
      setError(`Playback error (${errorCode}). Skipping to next channel...`);
      switchChannel('next');
    }
    
    // Clear error after 3 seconds
    setTimeout(() => setError(null), 3000);
  };

  const handleChannelChange = (channel: Channel) => {
    if (channel.id === currentChannel?.id) return;
    
    // Check for parental restrictions
    if (restrictedChannels.includes(channel.id)) {
      const pin = prompt('This channel is restricted. Enter Parental PIN:');
      if (pin !== parentalPin) {
        setError('Incorrect PIN. Access denied.');
        return;
      }
    }
    
    setIsZapping(true);
    setShowChannelNumber(true);
    setCurrentChannel(channel);
    setShowOverlay(true);
    setShowChannelList(false);
    
    // Refresh EPG for the new channel immediately
    if (!channel.is_live && !channel.live_video_id) {
      syncChannelPrograms(channel).then(() => {
        // If still no programs after sync, try live sync
        supabase.from('programs').select('id').eq('channel_id', channel.id).limit(1).then(({ data }) => {
          if (!data || data.length === 0) {
            syncLiveStatus();
          }
        });
      });
    }
    
    setTimeout(() => {
      setIsZapping(false);
    }, 800);

    if (channelNumberTimeoutRef.current) clearTimeout(channelNumberTimeoutRef.current);
    channelNumberTimeoutRef.current = setTimeout(() => {
      setShowChannelNumber(false);
    }, 3000);

    if (!channel.is_live) syncChannelPrograms(channel);
  };

  const [isBatchAdding, setIsBatchAdding] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);

  const handleBatchAdd = async (channelId: string, links: string) => {
    setIsBatchAdding(true);
    setBatchProgress(0);
    const lines = links.split(/[\n,]+/).map(l => l.trim()).filter(l => l);
    
    try {
      let videoIds: string[] = [];
      
      // Phase 1: Collect all video IDs
      for (const line of lines) {
        // Check if it's a playlist
        const playlistMatch = line.match(/[&?]list=([^&]+)/);
        if (playlistMatch) {
          const playlistId = playlistMatch[1];
          console.log(`Fetching playlist: ${playlistId}`);
          
          // Try No-API first
          let ids = await getNoApiPlaylistVideos(playlistId);
          
          // Fallback to API if No-API failed
          if (ids.length === 0) {
            const playlistVideos = await fetchPlaylistVideos(playlistId);
            ids = playlistVideos.map(v => v.contentDetails?.videoId || v.snippet?.resourceId?.videoId).filter(id => id);
          }
          
          if (ids.length > 0) {
            videoIds.push(...ids);
            continue;
          }
        }

        // Check if it's a standard URL or raw ID
        // Improved regex to handle more cases including raw IDs
        const videoMatch = line.match(/(?:v=|\/embed\/|\/watch\?v=|\/v\/|youtu\.be\/|\/shorts\/|^)([a-zA-Z0-9_-]{11})(?:[#&?].*)?$/);
        if (videoMatch && videoMatch[1]) {
          videoIds.push(videoMatch[1]);
          continue;
        }

        console.warn(`Could not parse video ID from line: ${line}`);
      }

      videoIds = [...new Set(videoIds)];
      setBatchTotal(videoIds.length);

      if (videoIds.length === 0) {
        setIsBatchAdding(false);
        alert("Could not find any valid YouTube video IDs in the provided links.");
        return;
      }

      console.log(`Found ${videoIds.length} unique video IDs. Fetching details (No-API)...`);

      // Phase 2: Fetch all video details
      const allVideoDetails = [];
      for (let i = 0; i < videoIds.length; i++) {
        setBatchProgress(i + 1);
        const id = videoIds[i];
        console.log(`Fetching details for video ${i + 1}/${videoIds.length}: ${id}`);
        
        // Try No-API first
        let details = await getNoApiVideoDetails(id);
        
        // Fallback to API if No-API failed
        if (!details) {
          console.log(`No-API fetch failed for ${id}, falling back to YouTube Data API...`);
          details = await getVideoDetails(id);
        }
        
        if (details) {
          allVideoDetails.push(details);
        }
        
        // Small delay to be polite
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      if (allVideoDetails.length === 0 && videoIds.length > 0) {
        setIsBatchAdding(false);
        alert(`Found ${videoIds.length} video IDs, but could not fetch details for any of them. This usually means your YouTube API quota is exceeded or the videos are private/deleted.`);
        return;
      }

      if (allVideoDetails.length < videoIds.length) {
        console.warn(`Only fetched details for ${allVideoDetails.length} out of ${videoIds.length} videos.`);
      }

      // Phase 3: Prepare batch insert
      const batchToInsert = [];
      for (let i = 0; i < allVideoDetails.length; i++) {
        const details = allVideoDetails[i];
        const durationStr = details.contentDetails?.duration || 'PT10M';
        const durationSeconds = parseISO8601Duration(durationStr);
        
        batchToInsert.push({
          channel_id: channelId,
          title: details.snippet.title,
          video_id: details.id,
          duration: durationSeconds,
          description: details.snippet.description
        });

        setBatchProgress(i + 1);
      }

      // Phase 4: Batch insert into Supabase
      if (batchToInsert.length > 0) {
        const { error } = await supabase
          .from('programs')
          .insert(batchToInsert);
        if (error) throw error;
      }

      setIsBatchAdding(false);
      const skipped = videoIds.length - allVideoDetails.length;
      alert(`Successfully added ${batchToInsert.length} programs.${skipped > 0 ? ` (${skipped} videos were skipped as they couldn't be found on YouTube)` : ''}`);
    } catch (err: any) {
      console.error("Batch add error:", err);
      setError(`Batch add failed: ${err.message}`);
      setIsBatchAdding(false);
    }
  };

  const handleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setIsAdmin(false);
      setShowAdminPanel(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAdminAuth = () => {
    if (isAdmin) {
      setShowAdminPanel(true);
    } else {
      setShowPasswordModal(true);
    }
  };

  const verifyPassword = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setShowAdminPanel(true);
      setShowPasswordModal(false);
      setPasswordInput('');
    } else {
      setError('Incorrect Password');
      setPasswordInput('');
    }
  };

  const handleAgeVerification = (isOver13: boolean) => {
    if (isOver13) {
      localStorage.setItem('ageVerified', 'true');
      setIsAgeVerified(true);
      setShowAgeGate(false);
      setHasInteracted(true);
    } else {
      alert('Sorry, this app is for users 13 years and older.');
    }
  };

  const toggleChannelRestriction = (channelId: string) => {
    setRestrictedChannels(prev => {
      const updated = prev.includes(channelId) 
        ? prev.filter(id => id !== channelId) 
        : [...prev, channelId];
      localStorage.setItem('restrictedChannels', JSON.stringify(updated));
      return updated;
    });
  };

  const updateParentalPin = (newPin: string) => {
    if (newPin.length < 4) {
      setError('PIN must be at least 4 digits.');
      return;
    }
    setParentalPin(newPin);
    localStorage.setItem('parentalPin', newPin);
    alert('Parental PIN updated successfully.');
  };

  const getScheduledProgramsForChannel = useCallback((channelId: string, channelPrograms: Program[]): ScheduledProgram[] => {
    if (channelPrograms.length === 0) return [];
    const sorted = [...channelPrograms].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    let lastEndTime = new Date(sorted[0].created_at);
    return sorted.map(p => {
      const start = lastEndTime;
      const end = new Date(start.getTime() + p.duration * 1000);
      lastEndTime = end;
      return { ...p, start, end };
    });
  }, []);

  const getActiveProgramForChannel = useCallback((channelId: string): ScheduledProgram | undefined => {
    const channelPrograms = programs.filter(p => p.channel_id === channelId);
    const scheduled = getScheduledProgramsForChannel(channelId, channelPrograms);
    const now = new Date();
    return scheduled.find(p => isWithinInterval(now, { start: p.start, end: p.end }));
  }, [programs, getScheduledProgramsForChannel]);

  const syncChannelPrograms = async (channel: Channel) => {
    // Only sync programs if not live and no live video ID exists
    if (channel.is_live && channel.live_video_id) return;

    try {
      // Get current programs
      const { data: current, error: fetchError } = await supabase
        .from('programs')
        .select('*')
        .eq('channel_id', channel.id)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      const count = current?.length || 0;
      if (count >= 10) return;

      const needed = 10 - count;

      // Fetch videos from YouTube
      let videos: any[] = [];
      if (channel.playlist_id) {
        videos = await fetchPlaylistVideos(channel.playlist_id);
      } else if (channel.query) {
        videos = await searchVideos(channel.query);
      } else if (channel.channel_id) {
        videos = await searchVideos('', 50, channel.channel_id);
      }

      if (videos.length === 0) return;

      // Shuffle videos for randomness as requested
      const shuffled = [...videos].sort(() => Math.random() - 0.5);

      for (let i = 0; i < needed; i++) {
        const video = shuffled[i % shuffled.length];
        const videoId = video.id?.videoId || video.contentDetails?.videoId || (typeof video.id === 'string' ? video.id : null);
        if (!videoId) continue;

        await addProgram(
          channel.id,
          video.snippet.title,
          videoId,
          video.snippet.description
        );
      }
    } catch (err) {
      console.error("Error syncing channel programs:", err);
    }
  };

  const handleReportContent = () => {
    if (!currentChannel) return;
    setComplianceType('report');
    setShowComplianceModal(true);
  };

  const handleDeleteAccountRequest = async () => {
    if (!session?.user) return;
    // In a real app, this would trigger a backend process or Supabase Edge Function
    // For now, we'll show a confirmation and provide instructions
    setComplianceType('deletion');
    setShowComplianceModal(true);
  };

  const syncLiveStatus = async (force = false) => {
    if (isSyncing) return;
    setIsSyncing(true);
    setError(null);
    
    let syncCount = 0;
    let liveCount = 0;
    const MAX_SYNC_PER_CYCLE = 10; // Limit syncs per cycle to save quota
    const SYNC_COOLDOWN = 10 * 60 * 1000; // 10 minutes cooldown per channel
    
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    
    try {
      console.log(`Starting live sync (force=${force})...`);
      // Get all channels to ensure we have the latest state
      const { data: allChannels } = await supabase.from('channels').select('*');
      if (!allChannels) {
        console.log("No channels found in database.");
        setIsSyncing(false);
        return;
      }

      // Group channels by their source ID (channel_id, username, or query)
      // This helps us identify which channels belong to the same "source"
      const sourceGroups: { [key: string]: Channel[] } = {};
      allChannels.forEach(c => {
        const sourceId = c.channel_id || c.username || c.query;
        if (sourceId) {
          if (!sourceGroups[sourceId]) sourceGroups[sourceId] = [];
          sourceGroups[sourceId].push(c);
        }
      });

      // Sort source groups by last_live_check to prioritize stale channels
      const sortedSourceIds = Object.keys(sourceGroups).sort((a, b) => {
        const lastA = sourceGroups[a][0].last_live_check ? new Date(sourceGroups[a][0].last_live_check).getTime() : 0;
        const lastB = sourceGroups[b][0].last_live_check ? new Date(sourceGroups[b][0].last_live_check).getTime() : 0;
        return lastA - lastB;
      });

      for (const sourceId of sortedSourceIds) {
        if (syncCount >= MAX_SYNC_PER_CYCLE && !force) {
          console.log(`Reached max sync limit (${MAX_SYNC_PER_CYCLE}) for this cycle. Stopping.`);
          break;
        }

        const relatedChannels = sourceGroups[sourceId].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        
        const mainChannel = relatedChannels[0]; // The oldest one is our "Primary"
        
        // --- QUOTA SAVING LOGIC ---
        // 1. Check cooldown
        const lastCheck = mainChannel.last_live_check ? new Date(mainChannel.last_live_check).getTime() : 0;
        const timeSinceLastCheck = Date.now() - lastCheck;
        if (!force && timeSinceLastCheck < SYNC_COOLDOWN) {
          console.log(`Skipping ${mainChannel.name} (checked ${Math.round(timeSinceLastCheck / 1000)}s ago, cooldown is 10m)`);
          continue;
        }

        // 2. Check if ANY of the related channels already have a live_video_id
        const liveChannel = relatedChannels.find(c => c.is_live && c.live_video_id);
        
        if (!force && liveChannel && liveChannel.live_video_id) {
          // CHEAP CHECK: Is it still live?
          console.log(`Checking if existing live stream for ${mainChannel.name} is still active: ${liveChannel.live_video_id}`);
          const stillLive = await isVideoLive(liveChannel.live_video_id);
          
          if (stillLive) {
            console.log(`Live stream for ${mainChannel.name} is still active. Skipping search.`);
            liveCount++;
            // Update last_live_check even if we skip search
            await supabase.from('channels').update({ last_live_check: new Date().toISOString() }).eq('id', mainChannel.id);
            continue;
          } else {
            console.log(`Live stream for ${mainChannel.name} has ended. Will search for new streams.`);
            // Mark it as not live so we can search again
            await supabase.from('channels').update({ is_live: false, live_video_id: null }).eq('id', liveChannel.id);
            liveChannel.is_live = false;
            liveChannel.live_video_id = undefined;
          }
        }
        
        // 3. Check for fallback programs (not "LIVE BROADCAST") for the main channel
        const { data: fallbackPrograms } = await supabase
          .from('programs')
          .select('id')
          .eq('channel_id', mainChannel.id)
          .neq('title', 'LIVE BROADCAST')
          .limit(1);

        const hasFallback = fallbackPrograms && fallbackPrograms.length > 0;

        // Only trigger sync if both live videos and fallback programs are not available
        // Exception: Priority channels like Kapamilya should always be scanned if they are currently live
        const isPriority = mainChannel.name.toLowerCase().includes('kapamilya');
        
        if (!force && !isPriority && hasFallback) {
          console.log(`Skipping sync for ${mainChannel.name} (has fallback programs)`);
          // Update last_live_check even if we skip search
          await supabase.from('channels').update({ last_live_check: new Date().toISOString() }).eq('id', mainChannel.id);
          continue;
        }
        
        // RATE LIMITING: Wait 1 second before each search
        if (syncCount > 0) await delay(1000);

        console.log(`Searching for live streams for ${mainChannel.name} using sourceId: ${sourceId}...`);
        let liveVideoIds = await detectLiveVideoIds(sourceId);
        // Unique the IDs to prevent duplicates
        liveVideoIds = Array.from(new Set(liveVideoIds));
        
        syncCount++;
        
        // Update last_live_check for the main channel
        await supabase.from('channels').update({ last_live_check: new Date().toISOString() }).eq('id', mainChannel.id);

        if (liveVideoIds.length > 0) {
          console.log(`Found ${liveVideoIds.length} live stream(s) for ${mainChannel.name}`);
          
          for (let i = 0; i < liveVideoIds.length; i++) {
            const liveVideoId = liveVideoIds[i];
            const channelName = liveVideoIds.length > 1 ? `${mainChannel.name.replace(/\s\d+$/, '')} ${i + 1}` : mainChannel.name.replace(/\s\d+$/, '');
            
            let targetChannelId = null;
            
            if (i < relatedChannels.length) {
              // Reuse existing channel
              targetChannelId = relatedChannels[i].id;
            } else {
              // Create new sub-channel
              const { data: newSub, error: subError } = await supabase
                .from('channels')
                .insert([{
                  name: channelName,
                  query: mainChannel.query,
                  username: mainChannel.username,
                  channel_id: mainChannel.channel_id,
                  is_live: true,
                  live_video_id: liveVideoId
                }])
                .select()
                .single();
                
              if (subError) throw subError;
              targetChannelId = newSub.id;
              // Add to relatedChannels so we don't try to create it again
              relatedChannels.push(newSub);
            }
            
            liveCount++;
            
            // Update channel to be live and store video ID
            await supabase
              .from('channels')
              .update({ 
                name: channelName,
                is_live: true,
                live_video_id: liveVideoId
              })
              .eq('id', targetChannelId);
          }

          // Delete any extra sub-channels that are no longer needed
          if (relatedChannels.length > liveVideoIds.length) {
            const toDelete = relatedChannels.slice(liveVideoIds.length);
            for (const extra of toDelete) {
              // First delete its programs to avoid foreign key issues
              await supabase.from('programs').delete().eq('channel_id', extra.id);
              // Then delete the channel
              await supabase.from('channels').delete().eq('id', extra.id);
            }
          }
        } else {
          console.log(`No live stream found for ${mainChannel.name}`);
          // Mark primary as not live
          await supabase
            .from('channels')
            .update({ 
              is_live: false,
              live_video_id: null
            })
            .eq('id', mainChannel.id);
            
          // Delete all sub-channels
          if (relatedChannels.length > 1) {
            const subChannels = relatedChannels.slice(1);
            for (const sub of subChannels) {
              await supabase.from('programs').delete().eq('channel_id', sub.id);
              await supabase.from('channels').delete().eq('id', sub.id);
            }
          }
        }
      }
      
      if (syncCount > 0) {
        console.log(`Sync complete. Scanned ${syncCount} channels, found ${liveCount} live streams.`);
      }
    } catch (err: any) {
      console.error("Sync error:", err);
      setError("Sync failed: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleChannelLive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('channels')
        .update({ is_live: !currentStatus })
        .eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
    }
  };

  const addChannel = async (channelData: Partial<Channel>) => {
    try {
      const { error } = await supabase
        .from('channels')
        .insert([{ 
          ...channelData,
          is_live: false
        }]);
      if (error) throw error;
      // Trigger sync for the new channel
      setTimeout(() => syncLiveStatus(), 1000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteChannel = async (id: string) => {
    if (!confirm('Are you sure you want to delete this channel?')) return;
    try {
      const { error } = await supabase
        .from('channels')
        .delete()
        .eq('id', id);
      if (error) throw error;
      if (currentChannel?.id === id) setCurrentChannel(null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const addProgram = async (channelId: string, title: string, videoIdOrUrl: string, description: string) => {
    try {
      let videoId = videoIdOrUrl.trim();
      
      // Extract video ID if a URL was provided
      const videoMatch = videoId.match(/(?:v=|\/embed\/|\/watch\?v=|\/v\/|youtu\.be\/|\/shorts\/|^)([a-zA-Z0-9_-]{11})(?:[#&?].*)?$/);
      if (videoMatch && videoMatch[1]) {
        videoId = videoMatch[1];
      }

      // Try No-API first
      let details = await getNoApiVideoDetails(videoId);
      
      // Fallback to YouTube Data API if No-API fails
      if (!details) {
        console.log("No-API fetch failed for single video, falling back to YouTube Data API...");
        details = await getVideoDetails(videoId);
      }

      if (!details) {
        console.warn(`Could not find details for video ID: ${videoId}. Using default duration.`);
      }

      const durationStr = details?.contentDetails?.duration || 'PT10M';
      const durationSeconds = parseISO8601Duration(durationStr);

      const { error } = await supabase
        .from('programs')
        .insert([{
          channel_id: channelId,
          title,
          video_id: videoId,
          duration: durationSeconds,
          description
        }]);
      if (error) throw error;
      
      alert(`Successfully scheduled "${title}"`);
    } catch (err: any) {
      console.error("Add program error:", err);
      setError(err.message);
    }
  };

  const deleteProgram = async (id: string) => {
    try {
      const { error } = await supabase
        .from('programs')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      setError(err.message);
    }
  };

  const nextProgram = scheduledPrograms
    .filter(p => p.start > new Date())
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0];

  // --- UI Components ---
  return (
    <div 
      className={cn(
        "fixed inset-0 bg-black text-white font-sans overflow-hidden transition-all duration-700",
        showOverlay ? "cursor-default" : "cursor-none"
      )}
      onMouseMove={() => {
        setShowOverlay(true);
        if (!hasInteracted) setHasInteracted(true);
      }}
      onClick={() => {
        setShowOverlay(true);
        if (!hasInteracted) setHasInteracted(true);
        if (isMuted && player) {
          player.unMute();
          setIsMuted(false);
        }
      }}
    >
      {/* Age Gate Overlay */}
      <AnimatePresence>
        {showAgeGate && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-black flex items-center justify-center p-6"
          >
            <div className="absolute inset-0 bg-[url('https://media.giphy.com/media/oEI9uWUAbjg3e/giphy.gif')] opacity-10 mix-blend-screen scale-150" />
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="relative z-10 w-full max-w-md bg-white/5 border border-white/10 rounded-[2.5rem] p-10 text-center space-y-8 backdrop-blur-2xl"
            >
              <div className="w-20 h-20 bg-red-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xl shadow-red-600/40">
                <Tv className="w-10 h-10 text-white" />
              </div>
              <div className="space-y-2">
                <h1 className="text-4xl font-black uppercase tracking-tighter italic">YouTV</h1>
                <p className="text-white/60 text-sm font-medium">This application may contain content suitable for mature audiences. Please confirm your age to continue.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => handleAgeVerification(true)}
                  className="py-4 bg-white text-black font-black rounded-2xl transition-all uppercase tracking-widest text-xs hover:scale-105 active:scale-95"
                >
                  I am 13+
                </button>
                <button 
                  onClick={() => handleAgeVerification(false)}
                  className="py-4 bg-white/10 hover:bg-white/20 text-white font-black rounded-2xl transition-all uppercase tracking-widest text-xs active:scale-95"
                >
                  Under 13
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Disclaimer Banner */}
      <AnimatePresence>
        {showDisclaimer && hasInteracted && (
          <motion.div 
            initial={{ y: -50 }}
            animate={{ y: 0 }}
            exit={{ y: -50 }}
            className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white py-2 px-4 flex items-center justify-center gap-4 text-[10px] font-black uppercase tracking-widest"
          >
            <div className="flex items-center gap-2">
              <Zap className="w-3 h-3" />
              <span>YouTV is a viewer for YouTube content. All videos are hosted on YouTube's servers.</span>
            </div>
            <button 
              onClick={() => { setComplianceType('terms'); setShowComplianceModal(true); }}
              className="underline hover:text-white/80 transition-colors"
            >
              Learn More
            </button>
            <button onClick={() => setShowDisclaimer(false)} className="p-1 hover:bg-white/10 rounded-full">
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {!hasInteracted && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] bg-black flex flex-col items-center justify-center gap-12 overflow-hidden"
          >
            <div className="absolute inset-0 bg-[url('https://media.giphy.com/media/oEI9uWUAbjg3e/giphy.gif')] opacity-10 mix-blend-screen scale-150" />
            
            <div className="relative z-10 flex flex-col items-center gap-6 text-center">
              <div className="w-32 h-32 bg-red-600 rounded-full flex items-center justify-center shadow-[0_0_100px_rgba(220,38,38,0.4)] animate-pulse">
                <MonitorPlay className="w-16 h-16 text-white" />
              </div>
              <div className="space-y-2">
                <h1 className="text-6xl font-black uppercase tracking-tighter leading-none">Retro TV</h1>
                <p className="text-white/40 text-sm font-black uppercase tracking-[0.5em]">Broadcast Network</p>
              </div>
            </div>

            <button 
              onClick={() => {
                setHasInteracted(true);
                setShowOverlay(true);
                if (player && player.playVideo) {
                  player.playVideo();
                  player.unMute();
                  setIsMuted(false);
                }
              }}
              className="relative z-10 px-12 py-5 bg-white text-black rounded-full font-black text-sm uppercase tracking-[0.3em] hover:scale-110 transition-transform active:scale-95 shadow-2xl shadow-white/20"
            >
              Start Watching
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Unmute Prompt (if muted) */}
      <AnimatePresence>
        {isMuted && hasInteracted && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="absolute bottom-32 left-1/2 -translate-x-1/2 z-50 bg-red-600 px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl shadow-red-600/40 cursor-pointer hover:scale-105 transition-transform"
            onClick={toggleMute}
          >
            <VolumeX className="w-5 h-5 text-white animate-pulse" />
            <span className="text-xs font-black uppercase tracking-widest text-white">Tap to Unmute</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Screen Video Player */}
      <div className="absolute inset-0 z-0 flex gap-0 items-start p-0 overflow-hidden bg-black">
        <div 
          ref={containerRef}
          className="h-full relative overflow-hidden transition-all duration-700"
          style={{ width: showAd ? 'calc(100% - 340px)' : '100%' }}
        >
          <div id="youtube-player" className={cn("w-full h-full scale-110 transition-all duration-700", !showOverlay && "pointer-events-none")} />
        </div>

        {/* Ad Sidebar */}
        <AnimatePresence>
          {showAd && adType === 'sidebar' && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="h-full bg-black/40 backdrop-blur-xl border-l border-white/10 p-6 flex flex-col gap-4 overflow-hidden z-10"
            >
              <YouTubeCompliantAd 
                type="sidebar" 
                duration={8000}
                onClose={hideAd}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* No Channels Message */}
      {channels.length === 0 && hasInteracted && (
        <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center gap-6 text-center p-10">
          <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center">
            <MonitorPlay className="w-12 h-12 text-white/20" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black uppercase tracking-tighter">No Channels Found</h2>
            <p className="text-white/40 text-sm max-w-xs">Please wait for the administrator to configure the channels.</p>
          </div>
        </div>
      )}

      {/* Off Air Static */}
      <AnimatePresence>
        {!currentProgram && hasInteracted && channels.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 bg-black flex flex-col items-center justify-center overflow-hidden"
          >
            <div className="absolute inset-0 bg-[url('https://media.giphy.com/media/oEI9uWUAbjg3e/giphy.gif')] opacity-40 mix-blend-screen scale-150" />
            <div className="relative z-10 flex flex-col items-center gap-4">
              <div className="text-4xl font-black uppercase tracking-[1em] text-white/20">Off Air</div>
              <div className="text-[10px] font-black uppercase tracking-[0.5em] text-white/10">Please check the guide for schedule</div>
              <div className="flex gap-4 mt-4">
                <button 
                  onClick={() => setShowEPG(true)}
                  className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Open Guide
                </button>
                <button 
                  onClick={() => syncLiveStatus()}
                  disabled={isSyncing}
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                >
                  <RefreshCw className={cn("w-3 h-3", isSyncing && "animate-spin")} />
                  {isSyncing ? 'Syncing...' : 'Sync Live'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zapping Effect (Static) */}
      <AnimatePresence>
        {isZapping && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black overflow-hidden"
          >
            <div className="absolute inset-0 bg-[url('https://media.giphy.com/media/oEI9uWUAbjg3e/giphy.gif')] opacity-20 mix-blend-screen scale-150" />
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Channel Number Indicator */}
      <AnimatePresence>
        {showChannelNumber && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            className="absolute top-10 left-10 z-[55] flex flex-col items-start gap-2 drop-shadow-[0_0_30px_rgba(0,0,0,0.8)]"
          >
            <div className="flex items-center gap-6">
              <div className="text-[12vw] font-black italic text-red-600 leading-none select-none drop-shadow-[0_0_50px_rgba(220,38,38,0.5)]">
                {currentChannel ? channels.indexOf(currentChannel) + 1 : ''}
              </div>
              <div className="space-y-1">
                <div className="text-4xl font-black uppercase tracking-tighter text-white">
                  {currentChannel?.name}
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-red-600 text-[8px] font-black rounded uppercase tracking-widest animate-pulse">Live</span>
                  <span className="text-white/40 font-bold text-xs uppercase tracking-widest">
                    {currentProgram ? format(currentProgram.start, 'HH:mm') : '--:--'}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Volume Overlay */}
      <AnimatePresence>
        {showVolumeOverlay && (
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="absolute top-1/2 right-10 -translate-y-1/2 z-50 flex flex-col items-center gap-4"
          >
            <div className="h-64 w-2 bg-white/10 rounded-full overflow-hidden relative">
              <motion.div 
                initial={false}
                animate={{ height: `${volume}%` }}
                className="absolute bottom-0 left-0 right-0 bg-red-600"
              />
            </div>
            <div className="w-12 h-12 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10">
              {isMuted || volume === 0 ? (
                <VolumeX className="w-5 h-5 text-red-500" />
              ) : (
                <Volume2 className="w-5 h-5 text-white" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Buffering Indicator */}
      <AnimatePresence>
        {isBuffering && !isZapping && hasInteracted && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/20 backdrop-blur-[1px]"
          >
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 border-4 border-red-600/20 border-t-red-600 rounded-full animate-spin" />
              <div className="text-[10px] font-black uppercase tracking-[0.5em] text-white/40 animate-pulse">Buffering</div>
              <button 
                onClick={() => {
                  if (player && player.playVideo) player.playVideo();
                }}
                className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest transition-all"
              >
                Force Play
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header Overlay */}
      <AnimatePresence>
        {showOverlay && (
          <motion.header 
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            exit={{ y: -100 }}
            className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between px-10 z-50"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center shadow-2xl shadow-red-600/40">
                <Tv className="w-7 h-7 text-white" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-3xl font-black tracking-tighter italic leading-none">YouTV</h1>
                <div className="flex items-center gap-2 mt-1">
                  <img src="https://www.youtube.com/img/desktop/yt_1200.png" alt="YouTube" className="h-3 opacity-50" />
                  <span className="text-[8px] text-white/40 font-bold uppercase tracking-widest">Content from YouTube</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-6">
                {isMuted && (
                  <div className="flex items-center gap-2 text-red-500 font-black uppercase tracking-widest text-[10px] animate-pulse">
                    <VolumeX className="w-4 h-4" />
                    Muted
                  </div>
                )}
                <button 
                  onClick={() => setShowEPG(true)}
                  className="flex items-center gap-2 text-white/60 hover:text-white transition-colors font-bold uppercase tracking-widest text-xs"
                >
                  <Calendar className="w-4 h-4" />
                  Guide
                </button>
                <button 
                  onClick={() => setShowChannelList(true)}
                  className="flex items-center gap-2 text-white/60 hover:text-white transition-colors font-bold uppercase tracking-widest text-xs"
                >
                  <MonitorPlay className="w-4 h-4" />
                  Channels
                </button>

                <button 
                  onClick={() => setShowParentalControls(true)}
                  className="flex items-center gap-2 text-white/60 hover:text-white transition-colors font-bold uppercase tracking-widest text-xs"
                >
                  <LogIn className="w-4 h-4" />
                  Parental
                </button>
                
                {/* Admin button removed for Play Store compliance - access via hidden gesture */}
                
                {session?.user ? (
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 bg-white/10 pl-1 pr-4 py-1 rounded-full border border-white/10">
                      <img src={session.user.user_metadata.avatar_url || ''} alt="" className="w-8 h-8 rounded-full" />
                      <span className="text-sm font-bold">{session.user.user_metadata.full_name}</span>
                      <button onClick={handleLogout} className="text-white/40 hover:text-red-500">
                        <LogOut className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={handleLogin} className="bg-white text-black px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest hover:scale-105 transition-transform">
                    Login
                  </button>
                )}
              </div>

              <div className="flex items-center gap-4 text-[8px] font-black uppercase tracking-widest text-white/20">
                <button onClick={() => { setComplianceType('terms'); setShowComplianceModal(true); }} className="hover:text-white transition-colors">Terms of Service</button>
                <button onClick={() => { setComplianceType('privacy'); setShowComplianceModal(true); }} className="hover:text-white transition-colors">Privacy Policy</button>
                <a href="https://www.youtube.com/t/terms" target="_blank" className="hover:text-white transition-colors">YouTube Terms</a>
                <a href="https://policies.google.com/privacy" target="_blank" className="hover:text-white transition-colors">Google Privacy</a>
              </div>
            </div>
          </motion.header>
        )}
      </AnimatePresence>

      {/* Bottom Channel Info Overlay */}
      <AnimatePresence>
        {showOverlay && currentChannel && (
          <>
            <motion.div 
            initial={{ y: 200 }}
            animate={{ y: 0 }}
            exit={{ y: 200 }}
            className="absolute bottom-0 left-0 right-0 p-10 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-50"
          >
            <div className="flex items-end justify-between gap-10">
              <div className="space-y-2">
                <div className="flex items-center gap-4">
                  <div className="text-6xl font-black italic text-red-600 drop-shadow-[0_0_20px_rgba(220,38,38,0.5)]">
                    {channels.indexOf(currentChannel) + 1}
                  </div>
                  <div>
                    <h2 className="text-4xl font-black uppercase tracking-tighter">{currentChannel.name}</h2>
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "px-2 py-0.5 text-[10px] font-black rounded uppercase tracking-widest animate-pulse flex items-center gap-1",
                        currentChannel.is_live ? "bg-red-600" : "bg-white/20"
                      )}>
                        <div className="w-1 h-1 bg-white rounded-full" />
                        {currentChannel.is_live ? 'LIVE' : 'REC'}
                      </span>

                      <div className="flex items-center gap-4 ml-2">
                        {currentProgram?.video_id && (
                          <a 
                            href={`https://www.youtube.com/watch?v=${currentProgram.video_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-white/40 hover:text-red-600 font-black uppercase tracking-widest transition-colors"
                          >
                            Watch on YouTube
                          </a>
                        )}
                        <button 
                          onClick={async () => {
                            const reason = prompt('Why are you reporting this content?', 'Inappropriate content');
                            if (reason && reason.trim()) {
                              try {
                                await supabase.from('reports').insert([{
                                  video_id: currentProgram?.video_id,
                                  channel_name: currentChannel?.name,
                                  reason: reason,
                                  reported_at: new Date().toISOString(),
                                  user_agent: navigator.userAgent
                                }]);
                                alert('Thank you for reporting. We will review within 72 hours.');
                              } catch (error) {
                                alert('Thank you for your report. Our team will review this content within 72 hours.');
                              }
                            }
                          }}
                          className="text-[10px] text-white/40 hover:text-red-600 font-black uppercase tracking-widest transition-colors"
                        >
                          Report
                        </button>
                      </div>
                      <button 
                        onClick={() => {
                          if (player && currentProgram) {
                            player.loadVideoById({
                              videoId: currentProgram.video_id,
                              startSeconds: calculateStartTime(currentProgram.start)
                            });
                            player.playVideo();
                          }
                        }}
                        className="p-1 rounded-full hover:bg-white/10 transition-all"
                        title="Reload Video"
                      >
                        <RefreshCw className="w-3 h-3 text-white/40" />
                      </button>
                      <button 
                        onClick={handleReportContent}
                        className="p-1 rounded-full hover:bg-white/10 transition-all"
                        title="Report Content"
                      >
                        <Info className="w-3 h-3 text-white/40" />
                      </button>
                      <button 
                        onClick={() => syncLiveStatus()}
                        disabled={isSyncing}
                        className={cn(
                          "p-1 rounded-full hover:bg-white/10 transition-all"
                        )}
                        title="Sync Live Status"
                      >
                        <Activity className={cn("w-3 h-3 text-white/40", isSyncing && "animate-spin")} />
                      </button>
                      <span className="text-white/40 font-bold text-sm uppercase tracking-widest">
                        {currentProgram ? format(currentProgram.start, 'HH:mm') : '--:--'}
                      </span>
                    </div>
                  </div>
                </div>
                {currentProgram && (
                  <div className="pl-20">
                    <h3 className="text-xl font-bold text-white/80">{currentProgram.title}</h3>
                    <p className="text-white/40 text-sm max-w-2xl line-clamp-2">{currentProgram.description}</p>
                    {nextProgram && (
                      <div className="mt-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/20">
                        <span className="text-white/40">Next:</span>
                        <span>{format(nextProgram.start, 'HH:mm')} - {nextProgram.title}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-4">
                <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-2xl">
                  <div className="flex flex-col items-end gap-1">
                    <div className="text-[8px] font-black text-white/20 uppercase tracking-widest">Signal</div>
                    <div className="flex gap-0.5 items-end h-3">
                      <div className="w-1 h-1 bg-red-600 rounded-full" />
                      <div className="w-1 h-2 bg-red-600 rounded-full" />
                      <div className="w-1 h-3 bg-red-600 rounded-full" />
                      <div className="w-1 h-2 bg-white/20 rounded-full" />
                    </div>
                  </div>
                  <div className="text-right border-l border-white/10 pl-4">
                    <div className="text-[10px] font-black text-white/40 uppercase tracking-widest">Next Program</div>
                    <div className="font-bold text-sm">
                      {scheduledPrograms.find(p => p.start > currentTime)?.title || 'End of Broadcast'}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-white/20" />
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="text-2xl font-black text-white tracking-tighter">
                    {format(currentTime, 'HH:mm:ss')}
                  </div>
                  <div className="text-[10px] font-black text-white/40 uppercase tracking-widest">
                    {format(currentTime, 'EEEE, MMM d, yyyy')}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Channel List Sidebar */}
      <AnimatePresence>
        {showChannelList && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="absolute top-0 right-0 bottom-0 w-96 bg-black/80 backdrop-blur-2xl border-l border-white/10 z-50 p-10 flex flex-col"
          >
            <div className="flex items-center justify-between mb-10">
              <h3 className="text-2xl font-black italic uppercase tracking-tighter">Channels</h3>
              <button onClick={() => setShowChannelList(false)} className="p-2 hover:bg-white/10 rounded-full">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div 
              ref={channelListRef}
              className="flex-1 overflow-y-auto space-y-4 pr-4 -mr-4 custom-scrollbar"
            >
              {channels.map((channel, idx) => (
                <button
                  key={channel.id}
                  onClick={() => handleChannelChange(channel)}
                  className={cn(
                    "w-full text-left p-6 rounded-2xl border transition-all group relative overflow-hidden outline-none",
                    currentChannel?.id === channel.id
                      ? "bg-red-600 border-red-600 shadow-2xl shadow-red-600/20"
                      : "bg-white/5 border-white/5 hover:bg-white/10",
                    focusedChannelIndex === idx && "ring-4 ring-white/40 border-white/20 bg-white/10"
                  )}
                >
                  <div className="relative z-10 flex items-center gap-6">
                    <div className={cn(
                      "text-4xl font-black italic",
                      currentChannel?.id === channel.id ? "text-white" : "text-white/20"
                    )}>
                      {idx + 1}
                    </div>
                    <div>
                      <div className="font-black uppercase tracking-tighter text-lg">{channel.name}</div>
                      <div className={cn(
                        "text-[10px] font-bold uppercase tracking-widest",
                        currentChannel?.id === channel.id ? "text-white/60" : "text-white/20"
                      )}>
                        {getActiveProgramForChannel(channel.id)?.title || 'Off Air'}
                      </div>
                    </div>
                  </div>
                  {currentChannel?.id === channel.id && (
                    <motion.div 
                      layoutId="active-channel"
                      className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"
                    />
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EPG Overlay */}
      <AnimatePresence>
        {showEPG && (
          <motion.div 
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="absolute inset-0 z-[60] bg-black/95 backdrop-blur-3xl p-20 flex flex-col"
          >
            <div className="flex items-center justify-between mb-20">
              <div className="space-y-2">
                <h2 className="text-6xl font-black italic uppercase tracking-tighter">TV Guide</h2>
                <p className="text-white/40 font-bold uppercase tracking-[0.3em] text-sm">Schedule for {format(new Date(), 'EEEE, MMMM do')}</p>
              </div>
              <button onClick={() => setShowEPG(false)} className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all hover:scale-110">
                <X className="w-10 h-10" />
              </button>
            </div>

            <div 
              ref={epgRef}
              className="flex-1 overflow-y-auto space-y-12 pr-10 -mr-10 custom-scrollbar"
            >
              {channels.map((channel, idx) => {
                const channelPrograms = programs.filter(p => p.channel_id === channel.id);
                const scheduled = getScheduledProgramsForChannel(channel.id, channelPrograms);
                const isFocused = focusedChannelIndex === idx;
                return (
                  <div key={channel.id} className={cn(
                    "space-y-6 p-6 rounded-3xl transition-all",
                    isFocused && "bg-white/5 ring-2 ring-white/20"
                  )}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center font-black italic text-xl">
                        {channels.indexOf(channel) + 1}
                      </div>
                      <h4 className="text-2xl font-black uppercase tracking-tighter">{channel.name}</h4>
                    </div>
                    <div className="flex gap-4 overflow-x-auto pb-4 -mb-4 no-scrollbar">
                      {scheduled.length > 0 ? (
                        scheduled.map(p => {
                          const now = new Date();
                          const isActive = isWithinInterval(now, { start: p.start, end: p.end });
                          return (
                            <div 
                              key={p.id}
                              className={cn(
                                "min-w-[300px] p-6 rounded-2xl border transition-all",
                                isActive ? "bg-red-600 border-red-600" : "bg-white/5 border-white/5"
                              )}
                            >
                              <div className="text-xs font-black uppercase tracking-widest mb-2 opacity-60">
                                {format(p.start, 'HH:mm')} - {format(p.end, 'HH:mm')}
                              </div>
                              <div className="font-black text-lg uppercase tracking-tighter mb-2">{p.title}</div>
                              <p className="text-xs opacity-40 line-clamp-2">{p.description}</p>
                            </div>
                          );
                        })
                      ) : (
                        <div className="flex flex-col items-center gap-4 p-10 bg-white/5 rounded-3xl border border-dashed border-white/10">
                          <div className="text-white/20 font-bold italic">No programs scheduled</div>
                          <button 
                            onClick={() => syncLiveStatus(true)}
                            disabled={isSyncing}
                            className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-full text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                          >
                            <RefreshCw className={cn("w-3 h-3", isSyncing && "animate-spin")} />
                            {isSyncing ? 'Syncing...' : 'Check for Live Stream'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Password Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-white/5 border border-white/10 rounded-[2rem] p-10 space-y-8 shadow-2xl"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 bg-red-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-red-600/40 mb-2">
                  <Settings className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-4xl font-black italic uppercase tracking-tighter">Admin Access</h2>
                <p className="text-white/40 font-bold uppercase tracking-widest text-xs">Enter your credentials to continue</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 ml-4">Password</label>
                  <input 
                    ref={passwordInputRef}
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && verifyPassword()}
                    placeholder="••••••••"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-lg font-bold focus:outline-none focus:border-red-600/50 transition-colors placeholder:text-white/10"
                    autoFocus
                  />
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => {
                      setShowPasswordModal(false);
                      setPasswordInput('');
                    }}
                    className="flex-1 px-8 py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={verifyPassword}
                    className="flex-1 px-8 py-4 bg-red-600 hover:bg-red-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-red-600/20"
                  >
                    Verify
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin Panel Overlay */}
      <AnimatePresence>
        {showAdminPanel && (
          <motion.div 
            ref={adminPanelRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl p-20 overflow-y-auto cursor-default"
          >
            <div className="max-w-6xl mx-auto space-y-20">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <h2 className="text-6xl font-black tracking-tighter italic uppercase">Admin Panel</h2>
                  <p className="text-red-600 font-black uppercase tracking-[0.5em] text-xs">Broadcast Management System</p>
                </div>
                <div className="flex items-center gap-6">
                  {!session?.user && (
                    <button 
                      onClick={() => {
                        setIsAdmin(false);
                        setShowAdminPanel(false);
                      }}
                      className="px-8 py-4 bg-white/5 hover:bg-red-600/20 hover:text-red-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all border border-white/10"
                    >
                      Logout Admin
                    </button>
                  )}
                  <button 
                    onClick={() => setShowAdminPanel(false)}
                    className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all hover:scale-110"
                  >
                    <X className="w-10 h-10" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
                {/* Add Channel */}
                <section className={cn(
                  "space-y-10 p-10 rounded-[3rem] transition-all",
                  focusedAdminIndex === 0 && "bg-white/5 ring-4 ring-red-600/20 border border-red-600/20"
                )}>
                  <h3 className="text-2xl font-black uppercase tracking-tighter border-l-8 border-red-600 pl-6">Add Channel</h3>
                  <form 
                    className="space-y-6"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const name = (form.elements.namedItem('name') as HTMLInputElement).value;
                      const channel_id = (form.elements.namedItem('channel_id') as HTMLInputElement).value;
                      const username = (form.elements.namedItem('username') as HTMLInputElement).value;
                      const query = (form.elements.namedItem('query') as HTMLInputElement).value;
                      const playlist_id = (form.elements.namedItem('playlist_id') as HTMLInputElement).value;
                      
                      addChannel({ name, channel_id, username, query, playlist_id });
                      form.reset();
                    }}
                  >
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Channel Name</label>
                      <input name="name" required className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-xl font-bold focus:outline-none focus:border-red-600 transition-colors" />
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Channel ID (UC...)</label>
                        <input name="channel_id" placeholder="UC..." className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-xl font-bold focus:outline-none focus:border-red-600 transition-colors" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Username (@handle)</label>
                        <input name="username" placeholder="@handle" className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-xl font-bold focus:outline-none focus:border-red-600 transition-colors" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Search Query</label>
                        <input name="query" placeholder="Channel Name Search" className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-xl font-bold focus:outline-none focus:border-red-600 transition-colors" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Playlist ID</label>
                        <input name="playlist_id" placeholder="PL..." className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-xl font-bold focus:outline-none focus:border-red-600 transition-colors" />
                      </div>
                    </div>
                    <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-6 rounded-2xl transition-all active:scale-95 uppercase tracking-widest text-sm">
                      Create Channel
                    </button>
                  </form>
                </section>

                {/* Add Program */}
                <section className={cn(
                  "space-y-10 p-10 rounded-[3rem] transition-all",
                  focusedAdminIndex === 2 && "bg-white/5 ring-4 ring-red-600/20 border border-red-600/20"
                )}>
                  <h3 className="text-2xl font-black uppercase tracking-tighter border-l-8 border-red-600 pl-6">Add Program</h3>
                  <div className="space-y-10">
                    {/* Single Add */}
                    <form 
                      className="space-y-6"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.target as HTMLFormElement;
                        const channelId = (form.elements.namedItem('channelId') as HTMLSelectElement).value;
                        const title = (form.elements.namedItem('title') as HTMLInputElement).value;
                        const videoId = (form.elements.namedItem('videoId') as HTMLInputElement).value;
                        const desc = (form.elements.namedItem('desc') as HTMLTextAreaElement).value;
                        
                        addProgram(channelId, title, videoId, desc);
                        form.reset();
                      }}
                    >
                      <div className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-4">Single Entry</div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Target Channel</label>
                        <select name="channelId" required className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-xl font-bold focus:outline-none focus:border-red-600 transition-colors appearance-none">
                          {channels.map(c => <option key={c.id} value={c.id} className="bg-[#0a0a0a]">{c.name}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Title</label>
                          <input name="title" required className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-xl font-bold focus:outline-none focus:border-red-600 transition-colors" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Video ID</label>
                          <input name="videoId" required className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-xl font-bold focus:outline-none focus:border-red-600 transition-colors" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Description</label>
                        <textarea name="desc" className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-xl font-bold focus:outline-none focus:border-red-600 transition-colors" rows={2} />
                      </div>
                      <button type="submit" className="w-full bg-white text-black hover:bg-white/90 font-black py-6 rounded-2xl transition-all active:scale-95 uppercase tracking-widest text-sm">
                        Schedule Program
                      </button>
                    </form>

                    <div className="h-px bg-white/10 w-full" />

                    {/* Batch Add */}
                    <form 
                      className="space-y-6"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.target as HTMLFormElement;
                        const channelId = (form.elements.namedItem('batchChannelId') as HTMLSelectElement).value;
                        const links = (form.elements.namedItem('links') as HTMLTextAreaElement).value;
                        handleBatchAdd(channelId, links);
                        form.reset();
                      }}
                    >
                      <div className="text-[10px] font-black text-white/20 uppercase tracking-widest mb-4">Batch Import (Unlimited)</div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Target Channel</label>
                        <select name="batchChannelId" required className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-xl font-bold focus:outline-none focus:border-red-600 transition-colors appearance-none">
                          {channels.map(c => <option key={c.id} value={c.id} className="bg-[#0a0a0a]">{c.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">YouTube Links / Playlist URL</label>
                        <textarea 
                          name="links" 
                          required 
                          placeholder="Paste YouTube video links (one per line) or a Playlist URL..."
                          className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-xl font-bold focus:outline-none focus:border-red-600 transition-colors min-h-[200px]" 
                        />
                        <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">Supports video links, shorts, and playlists. Programs will be scheduled sequentially.</p>
                      </div>
                      
                      {isBatchAdding ? (
                        <div className="space-y-4">
                          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full bg-red-600"
                              initial={{ width: 0 }}
                              animate={{ width: `${(batchProgress / batchTotal) * 100}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/40">
                            <span>Processing Batch...</span>
                            <span>{batchProgress} / {batchTotal}</span>
                          </div>
                        </div>
                      ) : (
                        <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-6 rounded-2xl transition-all active:scale-95 uppercase tracking-widest text-sm">
                          Start Batch Import
                        </button>
                      )}
                    </form>
                  </div>
                </section>
              </div>

              {/* Manage Section */}
              <section className={cn(
                "space-y-10 p-10 rounded-[3rem] transition-all",
                (focusedAdminIndex === 1 || focusedAdminIndex === 3) && "bg-white/5 ring-4 ring-red-600/20 border border-red-600/20"
              )}>
                <div className="flex items-center justify-between border-l-8 border-red-600 pl-6">
                  <h3 className="text-2xl font-black uppercase tracking-tighter">Manage Content</h3>
                  <button 
                    onClick={() => syncLiveStatus()}
                    disabled={isSyncing}
                    className={cn(
                      "flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95",
                      isSyncing ? "bg-white/10 text-white/40 cursor-not-allowed" : "bg-white text-black hover:bg-white/90"
                    )}
                  >
                    <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                    {isSyncing ? 'Syncing...' : 'Sync All Live Channels'}
                  </button>
                  <button 
                    onClick={() => window.location.reload()}
                    className="flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-white/10 text-white hover:bg-white/20 transition-all active:scale-95"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh App
                  </button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-20">
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.5em]">Channels</h4>
                    <div className="space-y-4">
                      {channels.map(c => (
                        <div key={c.id} className="flex items-center justify-between p-6 bg-white/5 rounded-2xl border border-white/5">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-4">
                              <span className="text-xl font-black uppercase tracking-tighter">{c.name}</span>
                              {c.is_live && <Zap className="w-4 h-4 text-red-500 animate-pulse" />}
                            </div>
                            {c.live_video_id && (
                              <div className="text-[10px] font-mono text-white/20 uppercase tracking-widest">
                                ID: {c.live_video_id}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => toggleChannelLive(c.id, c.is_live)}
                              className={cn(
                                "px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all",
                                c.is_live ? "bg-red-600 text-white" : "bg-white/10 text-white/40 hover:bg-white/20"
                              )}
                            >
                              {c.is_live ? 'Live Mode ON' : 'Live Mode OFF'}
                            </button>
                            <button onClick={() => deleteChannel(c.id)} className="text-red-500 hover:text-red-400 p-2">
                              <Trash2 className="w-6 h-6" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-6">
                    <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.5em]">Recent Programs</h4>
                    <div className="space-y-4">
                      {programs.slice(0, 10).map(p => (
                        <div key={p.id} className="flex items-center justify-between p-6 bg-white/5 rounded-2xl border border-white/5">
                          <div className="min-w-0">
                            <div className="text-xl font-black uppercase tracking-tighter truncate">{p.title}</div>
                            <div className="text-[10px] font-black text-white/40 uppercase tracking-widest">Duration: {Math.floor(p.duration / 60)}m {p.duration % 60}s</div>
                          </div>
                          <button onClick={() => deleteProgram(p.id)} className="text-red-500 hover:text-red-400 p-2 shrink-0">
                            <Trash2 className="w-6 h-6" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-10 left-10 right-10 md:left-auto md:w-[400px] bg-red-600 text-white p-6 rounded-2xl shadow-2xl flex items-center justify-between z-[200]">
          <div className="flex items-center gap-4">
            <Info className="w-6 h-6" />
            <p className="text-sm font-black uppercase tracking-tight">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="p-2 hover:bg-white/10 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Footer for Compliance */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
        <div className="flex items-center gap-4 text-[8px] font-black uppercase tracking-widest text-white/20">
          {session?.user && (
            <button onClick={handleDeleteAccountRequest} className="hover:text-red-500 transition-colors">Delete Account</button>
          )}
        </div>
        <div className="flex items-center gap-2 text-[8px] font-black uppercase tracking-widest text-white/10">
          <img src="https://www.youtube.com/img/desktop/yt_1200.png" alt="YouTube" className="h-3 opacity-20" />
          <span>YouTV is not affiliated with YouTube or Google. This app uses YouTube API Services.</span>
        </div>
      </div>

      {/* Compliance Modal */}
      <AnimatePresence>
        {showComplianceModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-2xl bg-white/5 border border-white/10 rounded-[2.5rem] p-10 space-y-8 max-h-[80vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-black italic uppercase tracking-tighter">
                  {complianceType === 'privacy' && 'Privacy Policy'}
                  {complianceType === 'terms' && 'Terms of Service'}
                  {complianceType === 'deletion' && 'Account Deletion'}
                  {complianceType === 'report' && 'Report Content'}
                </h2>
                <button onClick={() => setShowComplianceModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6 text-white/60 text-sm leading-relaxed font-medium">
                {complianceType === 'privacy' && (
                  <div className="space-y-6">
                    <p><strong>Last Updated:</strong> March 27, 2026</p>
                    <p>This Privacy Policy describes how your personal information is collected, used, and shared when you use YouTV.</p>
                    
                    <h3 className="text-white font-bold uppercase tracking-widest text-xs">YouTube API Services</h3>
                    <p>This application uses YouTube API Services. By using this app, you agree to be bound by the 
                    <a href="https://developers.google.com/youtube/terms/api-services-terms-of-service" target="_blank" className="text-red-500 hover:underline mx-1">YouTube Terms of Service</a> and 
                    <a href="https://policies.google.com/privacy" target="_blank" className="text-red-500 hover:underline mx-1">Google Privacy Policy</a>.</p>
                    <p>You can revoke access to your data by visiting 
                    <a href="https://security.google.com/settings/security/permissions" target="_blank" className="text-red-500 hover:underline mx-1">Google Security Settings</a>.</p>

                    <h3 className="text-white font-bold uppercase tracking-widest text-xs">Information We Do NOT Collect</h3>
                    <ul className="list-none space-y-1">
                      <li>❌ No personal identification information (name, email, address)</li>
                      <li>❌ No location data</li>
                      <li>❌ No contact lists or phone numbers</li>
                      <li>❌ No biometric data</li>
                      <li>❌ No financial information</li>
                    </ul>

                    <h3 className="text-white font-bold uppercase tracking-widest text-xs">Data Collection & Retention</h3>
                    <p>We collect basic information provided by your authentication provider to manage your account and preferences. We do not store any personal data beyond authentication tokens. Your preferences are stored locally on your device.</p>

                    <h3 className="text-white font-bold uppercase tracking-widest text-xs">Children's Privacy (COPPA)</h3>
                    <p>This application is intended for users aged 13 and above. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us.</p>

                    <h3 className="text-white font-bold uppercase tracking-widest text-xs">Data Security</h3>
                    <p>We implement reasonable security measures to protect any data we collect. However, no method of transmission over the Internet is 100% secure.</p>

                    <h3 className="text-white font-bold uppercase tracking-widest text-xs">Cookies</h3>
                    <p>We use essential cookies to maintain your session and preferences. You can disable cookies in your browser settings, but this may affect app functionality.</p>

                    <h3 className="text-white font-bold uppercase tracking-widest text-xs">Third-Party Services</h3>
                    <p>This application uses:</p>
                    <ul className="list-none space-y-1">
                      <li><strong>YouTube API Services</strong> - For video content. <a href="https://developers.google.com/youtube/terms/api-services-terms-of-service" target="_blank" className="text-red-500 hover:underline ml-1">YouTube Terms</a></li>
                      <li><strong>Supabase</strong> - For storing channel information. <a href="https://supabase.com/privacy" target="_blank" className="text-red-500 hover:underline ml-1">Supabase Privacy</a></li>
                    </ul>

                    <h3 className="text-white font-bold uppercase tracking-widest text-xs">Your Rights (GDPR)</h3>
                    <p>If you are in the European Economic Area, you have the right to access, rectify, or request deletion of your data, as well as restrict processing and data portability.</p>

                    <h3 className="text-white font-bold uppercase tracking-widest text-xs">California Privacy Rights (CCPA)</h3>
                    <p>California residents have the right to know what personal information is collected, request deletion, and opt-out of data sales (we do not sell data).</p>

                    <h3 className="text-white font-bold uppercase tracking-widest text-xs">Contact Us</h3>
                    <p>Email: <span className="text-white font-bold">itservicesprimenet@gmail.com</span></p>
                    <p>Response Time: Within 5 business days</p>
                  </div>
                )}

                {complianceType === 'terms' && (
                  <div className="space-y-6">
                    <p><strong>Last Updated:</strong> March 27, 2026</p>
                    <p>By accessing or using this application, you agree to be bound by these Terms of Service.</p>
                    
                    <h3 className="text-white font-bold uppercase tracking-widest text-xs">Age Restriction</h3>
                    <p>You must be at least 13 years old to use this application. If you are between 13 and 18, you must have parental consent to use this app.</p>

                    <h3 className="text-white font-bold uppercase tracking-widest text-xs">YouTube API Terms Compliance</h3>
                    <p>By using this application, users are bound by the 
                    <a href="https://developers.google.com/youtube/terms/api-services-terms-of-service" target="_blank" className="text-red-500 hover:underline mx-1">YouTube Terms of Service</a> and 
                    <a href="https://policies.google.com/privacy" target="_blank" className="text-red-500 hover:underline mx-1">Google Privacy Policy</a>.</p>

                    <h3 className="text-white font-bold uppercase tracking-widest text-xs">User Content & Reporting</h3>
                    <p>You may report inappropriate content by clicking the report button within the app. We will review and take appropriate action within 72 hours.</p>

                    <h3 className="text-white font-bold uppercase tracking-widest text-xs">Copyright Infringement (DMCA)</h3>
                    <p>If you believe content in this app infringes your copyright, please contact us at <span className="text-white font-bold">itservicesprimenet@gmail.com</span> with identification of the copyrighted work and infringing content.</p>

                    <h3 className="text-white font-bold uppercase tracking-widest text-xs">Limitation of Liability</h3>
                    <p>This application is provided "as is" without warranties. We are not liable for any damages arising from use of this app. All trademarks and copyrights belong to their respective owners.</p>

                    <h3 className="text-white font-bold uppercase tracking-widest text-xs">Termination</h3>
                    <p>We reserve the right to terminate access to any user who violates these terms or uses the app inappropriately.</p>

                    <h3 className="text-white font-bold uppercase tracking-widest text-xs">Governing Law</h3>
                    <p>These terms are governed by the laws of the Republic of the Philippines. Any disputes shall be resolved in the courts of Manila.</p>

                    <h3 className="text-white font-bold uppercase tracking-widest text-xs">Contact Us</h3>
                    <p>Email: <span className="text-white font-bold">itservicesprimenet@gmail.com</span></p>
                  </div>
                )}

                {complianceType === 'deletion' && (
                  <>
                    <p className="text-red-500 font-bold">You are requesting to delete your account and all associated data.</p>
                    <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4">
                      <p>To comply with Google Play policies, we provide a direct way to request data deletion.</p>
                      <p>Please send an email to <span className="text-white font-bold">itservicesprimenet@gmail.com</span> with the subject "ACCOUNT DELETION REQUEST" from your registered email address.</p>
                      <p>Your data will be permanently removed from our systems within 7 business days.</p>
                    </div>
                    <button 
                      onClick={() => {
                        window.location.href = "mailto:itservicesprimenet@gmail.com?subject=ACCOUNT DELETION REQUEST&body=Please delete my account and all associated data for the YouTube Live TV app.";
                      }}
                      className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl transition-all uppercase tracking-widest text-xs"
                    >
                      Send Deletion Email
                    </button>
                  </>
                )}

                {complianceType === 'report' && (
                  <>
                    <p>If you find content that violates our terms or community guidelines, please report it.</p>
                    <div className="bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4">
                      <p>Current Channel: <span className="text-white font-bold uppercase">{currentChannel?.name}</span></p>
                      <p>Since all content is hosted on YouTube, the most effective way to report content is directly on YouTube's platform.</p>
                      <button 
                        onClick={() => {
                          const videoId = currentProgram?.video_id || currentChannel?.live_video_id;
                          if (videoId) window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
                        }}
                        className="w-full py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                      >
                        <Play className="w-4 h-4" /> View on YouTube to Report
                      </button>
                    </div>
                    <p>Alternatively, you can report it to us directly at <span className="text-white font-bold">itservicesprimenet@gmail.com</span>.</p>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Parental Controls Modal */}
      <AnimatePresence>
        {showParentalControls && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-2xl bg-white/5 border border-white/10 rounded-[2.5rem] p-10 space-y-8 max-h-[80vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-3xl font-black italic uppercase tracking-tighter">Parental Controls</h2>
                <button onClick={() => setShowParentalControls(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-8">
                <section className="space-y-4">
                  <h3 className="text-white font-bold uppercase tracking-widest text-xs">Restrict Channels</h3>
                  <p className="text-white/40 text-xs">Restricted channels will require the Parental PIN to view.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {channels.map(channel => (
                      <button
                        key={channel.id}
                        onClick={() => toggleChannelRestriction(channel.id)}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-2xl border transition-all",
                          restrictedChannels.includes(channel.id)
                            ? "bg-red-600/20 border-red-600 text-white"
                            : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
                        )}
                      >
                        <span className="font-bold text-sm uppercase tracking-tight">{channel.name}</span>
                        {restrictedChannels.includes(channel.id) && <LogIn className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="space-y-4 border-t border-white/10 pt-8">
                  <h3 className="text-white font-bold uppercase tracking-widest text-xs">Update Parental PIN</h3>
                  <div className="flex gap-4">
                    <input 
                      type="password"
                      placeholder="New 4-digit PIN"
                      maxLength={4}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-white/20 transition-all font-mono"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          updateParentalPin((e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                    />
                    <button 
                      onClick={(e) => {
                        const input = (e.currentTarget.previousSibling as HTMLInputElement);
                        updateParentalPin(input.value);
                        input.value = '';
                      }}
                      className="px-6 py-3 bg-white text-black font-black rounded-xl uppercase tracking-widest text-[10px]"
                    >
                      Update
                    </button>
                  </div>
                </section>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Floating Corner Ad */}
      {showCornerAd && (
        <YouTubeCompliantAd 
          type="corner" 
          duration={8000}
          onClose={() => setShowCornerAd(false)}
        />
      )}

      {/* YouTube Attribution Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-xl border-t border-white/5 py-4 px-10 z-[70]">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <img 
              src="https://www.youtube.com/img/desktop/yt_1200.png" 
              alt="YouTube" 
              className="h-4 opacity-50"
              referrerPolicy="no-referrer"
            />
            <div className="text-[9px] text-white/40 font-bold uppercase tracking-[0.2em] text-center">
              YouTV is not affiliated with YouTube or Google. This app uses YouTube API Services.
            </div>
          </div>
          <div className="flex items-center gap-4 text-[8px] font-black uppercase tracking-widest text-white/20">
            <a href="https://www.youtube.com/t/terms" target="_blank" className="hover:text-white transition-colors">YouTube Terms</a>
            <a href="https://policies.google.com/privacy" target="_blank" className="hover:text-white transition-colors">Google Privacy</a>
          </div>
        </div>
      </div>
    </div>
  );
}
