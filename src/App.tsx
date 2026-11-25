import {
  Clock,
  Globe,
  Heart,
  ListMusic,
  Menu,
  Pencil,
  Play,
  Plus,
  RotateCw,
  Search,
  Shuffle,
  Trash2,
  WifiOff,
  X,
} from 'lucide-react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { YouTubePlayerBridge } from './audio/YouTubePlayerBridge';
import { ConfirmModal } from './components/ConfirmModal';
import { CoverArt } from './components/CoverArt';
import { PlayerBar } from './components/PlayerBar';
import { PlaylistModal } from './components/PlaylistModal';
import { QueueDrawer } from './components/QueueDrawer';
import { Sidebar } from './components/Sidebar';
import { TrackTable } from './components/TrackTable';
import {
  LibraryView,
  PlayerPrefs,
  Playlist,
  RecentPlayEntry,
  RepeatMode,
  Track,
} from './types/music';
import { formatDuration } from './utils/format';
import {
  loadLikedIds,
  loadOnlineTracksCache,
  loadPlayerPrefs,
  loadPlaylists,
  loadRecentPlays,
  saveLikedIds,
  saveOnlineTracksCache,
  savePlayerPrefs,
  savePlaylists,
  saveRecentPlays,
} from './utils/storage';

export default function App() {
  // Persistent localStorage state for online songs
  const [likedIdsList, setLikedIdsList] = useState<string[]>(() => loadLikedIds());
  const [recentPlays, setRecentPlays] = useState<RecentPlayEntry[]>(() => loadRecentPlays());
  const [playlists, setPlaylists] = useState<Playlist[]>(() => loadPlaylists());
  const [onlineCache, setOnlineCache] = useState<Track[]>(() => loadOnlineTracksCache());
  const [prefs, setPrefs] = useState<PlayerPrefs>(() => loadPlayerPrefs());

  // Navigation & filtering
  const [activeView, setActiveView] = useState<LibraryView>('discover');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isOfflineNetwork, setIsOfflineNetwork] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  // Online Search State
  const [onlineQuery, setOnlineQuery] = useState('');
  const [onlineResults, setOnlineResults] = useState<Track[]>([]);
  const [onlineLoading, setOnlineLoading] = useState(false);
  const [onlineError, setOnlineError] = useState<{ code?: string; message: string } | null>(null);
  const [apiConfigured, setApiConfigured] = useState<boolean | null>(null);

  // Trending in India (Bollywood Hindi songs) State
  const [trendingTracks, setTrendingTracks] = useState<Track[]>([]);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [trendingError, setTrendingError] = useState<string | null>(null);

  // Playback state
  const [queue, setQueue] = useState<Track[]>(() => loadOnlineTracksCache().slice(0, 10));
  const [queueIndex, setQueueIndex] = useState<number>(0);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(() => {
    const initialPrefs = loadPlayerPrefs();
    const cached = loadOnlineTracksCache();
    return cached.find((t) => t.id === initialPrefs.lastTrackId) || cached[0] || null;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => loadPlayerPrefs().lastPosition || 0);
  const [duration, setDuration] = useState(() => currentTrack?.duration || 0);

  // Modals & Toast
  const [playlistModal, setPlaylistModal] = useState<{
    open: boolean;
    mode: 'create' | 'rename';
    playlistId?: string;
    pendingTrackId?: string;
  }>({ open: false, mode: 'create' });
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    onConfirm: () => {},
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const ytBridgeRef = useRef<YouTubePlayerBridge | null>(null);
  const hasLoadedOnceRef = useRef<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // Derived Sets & Maps
  const trackMap = useMemo(() => {
    const map = new Map<string, Track>();
    for (const tr of onlineCache) map.set(tr.id, tr);
    for (const tr of trendingTracks) map.set(tr.id, tr);
    for (const tr of onlineResults) map.set(tr.id, tr);
    if (currentTrack) map.set(currentTrack.id, currentTrack);
    return map;
  }, [onlineCache, trendingTracks, onlineResults, currentTrack]);

  const likedSet = useMemo(() => new Set(likedIdsList), [likedIdsList]);
  const recentMap = useMemo(
    () => new Map(recentPlays.map((entry) => [entry.trackId, entry])),
    [recentPlays]
  );

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 2600);
  }, []);

  // Persist localStorage slices
  useEffect(() => saveLikedIds(likedIdsList), [likedIdsList]);
  useEffect(() => saveRecentPlays(recentPlays), [recentPlays]);
  useEffect(() => savePlaylists(playlists), [playlists]);
  useEffect(() => saveOnlineTracksCache(onlineCache), [onlineCache]);
  useEffect(() => savePlayerPrefs(prefs), [prefs]);

  const fetchTrendingIndia = useCallback(async (forceRefresh = false) => {
    setTrendingLoading(true);
    setTrendingError(null);
    try {
      const url = forceRefresh
        ? '/api/youtube/trending-india?refresh=1'
        : '/api/youtube/trending-india';
      const resp = await fetch(url);
      const data = (await resp.json()) as {
        tracks?: Track[];
        error?: string;
        message?: string;
      };
      if (!resp.ok) {
        if (data.error === 'YOUTUBE_API_KEY_MISSING') {
          setApiConfigured(false);
        }
        setTrendingError(data.message || 'Could not load Trending in India.');
        return;
      }
      setApiConfigured(true);
      setTrendingTracks(data.tracks || []);
    } catch {
      setTrendingError('Network error while loading Trending in India.');
    } finally {
      setTrendingLoading(false);
    }
  }, []);

  // Check server health & load Trending in India on startup
  useEffect(() => {
    fetch('/api/health')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { youtubeConfigured?: boolean } | null) => {
        if (data && typeof data.youtubeConfigured === 'boolean') {
          setApiConfigured(data.youtubeConfigured);
        }
      })
      .catch(() => {
        // Ignore when unreachable
      });

    void fetchTrendingIndia(false);
  }, [fetchTrendingIndia]);

  // Network online/offline indicator
  useEffect(() => {
    const onOnline = () => setIsOfflineNetwork(false);
    const onOffline = () => setIsOfflineNetwork(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const cacheOnlineTrack = useCallback((track: Track) => {
    setOnlineCache((prev) => {
      const filtered = prev.filter((t) => t.id !== track.id);
      return [track, ...filtered].slice(0, 100);
    });
  }, []);

  const recordRecentPlay = useCallback((trackId: string) => {
    setRecentPlays((prev) => {
      const existing = prev.find((e) => e.trackId === trackId);
      const nextCount = (existing?.playCount || 0) + 1;
      const filtered = prev.filter((e) => e.trackId !== trackId);
      return [{ trackId, playedAt: Date.now(), playCount: nextCount }, ...filtered].slice(0, 50);
    });
  }, []);

  const startOnlinePlayback = useCallback(
    (track: Track, startAt = 0) => {
      hasLoadedOnceRef.current = track.id;
      cacheOnlineTrack(track);
      void ytBridgeRef.current?.loadAndPlay(track.youtubeId, startAt);
    },
    [cacheOnlineTrack]
  );

  // Play specific online track inside a context list
  const playTrackInContext = useCallback(
    (track: Track, contextList: Track[], startAt = 0) => {
      const activeList = contextList.length > 0 ? contextList : [track];
      const idx = Math.max(
        0,
        activeList.findIndex((t) => t.id === track.id)
      );
      setQueue(activeList);
      setQueueIndex(idx);
      setCurrentTrack(track);
      setCurrentTime(startAt);
      setDuration(track.duration);
      setIsPlaying(true);
      setPrefs((p) => ({ ...p, lastTrackId: track.id, lastPosition: startAt }));
      recordRecentPlay(track.id);
      startOnlinePlayback(track, startAt);
    },
    [recordRecentPlay, startOnlinePlayback]
  );

  const playTrack = useCallback(
    (track: Track, contextList: Track[]) => {
      playTrackInContext(track, contextList, 0);
    },
    [playTrackInContext]
  );

  // Refs for stable callbacks inside hidden stream player bridge
  const nextTrackRef = useRef<() => void>(() => {});
  const currentTrackRef = useRef<Track | null>(currentTrack);
  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  const handleNext = useCallback(() => {
    if (queue.length === 0) return;

    if (prefs.repeat === 'one' && currentTrack) {
      playTrackInContext(currentTrack, queue, 0);
      return;
    }

    let nextIdx = queueIndex + 1;
    if (prefs.shuffle && queue.length > 1) {
      let candidate = Math.floor(Math.random() * queue.length);
      if (candidate === queueIndex) candidate = (queueIndex + 1) % queue.length;
      nextIdx = candidate;
    } else if (nextIdx >= queue.length) {
      if (prefs.repeat === 'all') {
        nextIdx = 0;
      } else {
        setIsPlaying(false);
        return;
      }
    }

    const nextTrack = queue[nextIdx];
    if (nextTrack) {
      setQueueIndex(nextIdx);
      setCurrentTrack(nextTrack);
      setCurrentTime(0);
      setDuration(nextTrack.duration);
      setIsPlaying(true);
      setPrefs((p) => ({ ...p, lastTrackId: nextTrack.id, lastPosition: 0 }));
      recordRecentPlay(nextTrack.id);
      startOnlinePlayback(nextTrack, 0);
    }
  }, [
    queue,
    queueIndex,
    prefs.repeat,
    prefs.shuffle,
    currentTrack,
    playTrackInContext,
    recordRecentPlay,
    startOnlinePlayback,
  ]);

  useEffect(() => {
    nextTrackRef.current = handleNext;
  }, [handleNext]);

  const handlePrev = useCallback(() => {
    if (!currentTrack || queue.length === 0) return;
    if (currentTime > 4) {
      ytBridgeRef.current?.seek(0);
      setCurrentTime(0);
      return;
    }
    const prevIdx = (queueIndex - 1 + queue.length) % queue.length;
    const prevTrack = queue[prevIdx];
    if (prevTrack) {
      setQueueIndex(prevIdx);
      setCurrentTrack(prevTrack);
      setCurrentTime(0);
      setDuration(prevTrack.duration);
      setIsPlaying(true);
      setPrefs((p) => ({ ...p, lastTrackId: prevTrack.id, lastPosition: 0 }));
      recordRecentPlay(prevTrack.id);
      startOnlinePlayback(prevTrack, 0);
    }
  }, [currentTrack, currentTime, queue, queueIndex, recordRecentPlay, startOnlinePlayback]);

  // Initialize hidden stream player bridge once
  useEffect(() => {
    const ytBridge = new YouTubePlayerBridge('youtube-player-host', {
      onTimeUpdate: (t, dur) => {
        if (currentTrackRef.current) {
          setCurrentTime(t);
          if (dur > 0) setDuration(dur);
        }
      },
      onStateChange: (playing) => {
        if (currentTrackRef.current) {
          setIsPlaying(playing);
        }
      },
      onEnded: () => {
        if (currentTrackRef.current) {
          nextTrackRef.current();
        }
      },
      onError: (msg) => {
        setIsPlaying(false);
        showToast(msg);
      },
    });
    ytBridge.setVolume(prefs.volume);
    ytBridge.setMuted(prefs.muted);
    ytBridgeRef.current = ytBridge;

    return () => {
      ytBridge.destroy();
      ytBridgeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save lastPosition periodically in localStorage
  useEffect(() => {
    if (!currentTrack) return;
    const rounded = Math.floor(currentTime);
    if (rounded !== prefs.lastPosition && rounded % 3 === 0) {
      setPrefs((p) => ({ ...p, lastPosition: rounded }));
    }
  }, [currentTime, currentTrack, prefs.lastPosition]);

  const handleTogglePlayClean = useCallback(() => {
    if (!currentTrack) return;

    if (isPlaying) {
      ytBridgeRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (hasLoadedOnceRef.current !== currentTrack.id) {
        recordRecentPlay(currentTrack.id);
        startOnlinePlayback(currentTrack, currentTime);
      } else {
        ytBridgeRef.current?.resume();
      }
      setIsPlaying(true);
    }
  }, [currentTrack, isPlaying, currentTime, recordRecentPlay, startOnlinePlayback]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (isInput) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlayClean();
      } else if (e.code === 'ArrowRight' && e.shiftKey) {
        e.preventDefault();
        handleNext();
      } else if (e.code === 'ArrowLeft' && e.shiftKey) {
        e.preventDefault();
        handlePrev();
      } else if (e.code === 'ArrowRight' && currentTrack) {
        e.preventDefault();
        const nextSec = Math.min(duration, currentTime + 5);
        setCurrentTime(nextSec);
        ytBridgeRef.current?.seek(nextSec);
      } else if (e.code === 'ArrowLeft' && currentTrack) {
        e.preventDefault();
        const prevSec = Math.max(0, currentTime - 5);
        setCurrentTime(prevSec);
        ytBridgeRef.current?.seek(prevSec);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleTogglePlayClean, handleNext, handlePrev, currentTrack, currentTime, duration]);

  // Online Search Handler
  const searchOnline = useCallback(async (queryText: string) => {
    const clean = queryText.trim();
    if (!clean) return;
    setOnlineQuery(clean);
    setSearchQuery(clean);
    setActiveView('search');
    setOnlineLoading(true);
    setOnlineError(null);

    try {
      const resp = await fetch(
        `/api/youtube/search?q=${encodeURIComponent(clean)}&maxResults=15`
      );
      const data = (await resp.json()) as {
        tracks?: Track[];
        error?: string;
        message?: string;
      };

      if (!resp.ok) {
        setOnlineResults([]);
        setOnlineError({
          code: data.error,
          message: data.message || 'Online search failed.',
        });
        if (data.error === 'YOUTUBE_API_KEY_MISSING') {
          setApiConfigured(false);
        }
        return;
      }

      setApiConfigured(true);
      setOnlineResults(data.tracks || []);
    } catch {
      setOnlineError({
        code: 'NETWORK_ERROR',
        message: 'Network error while searching online catalog.',
      });
    } finally {
      setOnlineLoading(false);
    }
  }, []);

  const handleOnlineFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    void searchOnline(onlineQuery);
  };

  // Library actions
  const toggleLike = useCallback(
    (trackId: string) => {
      const targetTrack = trackMap.get(trackId);
      if (targetTrack) {
        cacheOnlineTrack(targetTrack);
      }
      setLikedIdsList((prev) => {
        const exists = prev.includes(trackId);
        const next = exists ? prev.filter((id) => id !== trackId) : [trackId, ...prev];
        const trackTitle = targetTrack?.title || 'Track';
        showToast(exists ? `Removed "${trackTitle}" from Liked Songs` : `Liked "${trackTitle}"`);
        return next;
      });
    },
    [trackMap, cacheOnlineTrack, showToast]
  );

  const addToQueue = useCallback(
    (track: Track) => {
      cacheOnlineTrack(track);
      setQueue((prev) => [...prev, track]);
      showToast(`Added "${track.title}" to Up Next`);
    },
    [cacheOnlineTrack, showToast]
  );

  const addTrackToPlaylist = useCallback(
    (playlistId: string, trackId: string) => {
      const targetTrack = trackMap.get(trackId);
      if (targetTrack) {
        cacheOnlineTrack(targetTrack);
      }
      setPlaylists((prev) =>
        prev.map((pl) => {
          if (pl.id !== playlistId) return pl;
          if (pl.trackIds.includes(trackId)) return pl;
          return { ...pl, trackIds: [...pl.trackIds, trackId] };
        })
      );
      const plName = playlists.find((p) => p.id === playlistId)?.name || 'Playlist';
      showToast(`Added to "${plName}"`);
    },
    [playlists, trackMap, cacheOnlineTrack, showToast]
  );

  const removeTrackFromPlaylist = useCallback(
    (playlistId: string, trackId: string) => {
      setPlaylists((prev) =>
        prev.map((pl) =>
          pl.id === playlistId
            ? { ...pl, trackIds: pl.trackIds.filter((id) => id !== trackId) }
            : pl
        )
      );
      showToast('Removed track from playlist');
    },
    [showToast]
  );

  // Library resolved lists
  const likedTracks = useMemo(
    () => likedIdsList.map((id) => trackMap.get(id)).filter((t): t is Track => Boolean(t)),
    [likedIdsList, trackMap]
  );

  const recentTracks = useMemo(
    () =>
      recentPlays
        .map((entry) => trackMap.get(entry.trackId))
        .filter((t): t is Track => Boolean(t)),
    [recentPlays, trackMap]
  );

  const activePlaylist = useMemo(
    () => playlists.find((p) => p.id === selectedPlaylistId) || null,
    [playlists, selectedPlaylistId]
  );
  const activePlaylistTracks = useMemo(() => {
    if (!activePlaylist) return [];
    return activePlaylist.trackIds
      .map((id) => trackMap.get(id))
      .filter((t): t is Track => Boolean(t));
  }, [activePlaylist, trackMap]);

  const upNextTracks = useMemo(() => queue.slice(queueIndex + 1), [queue, queueIndex]);

  const handlePlayShuffled = (tracksToShuffle: Track[]) => {
    if (tracksToShuffle.length === 0) return;
    const shuffled = [...tracksToShuffle].sort(() => Math.random() - 0.5);
    setPrefs((p) => ({ ...p, shuffle: true }));
    playTrack(shuffled[0], shuffled);
  };

  const cycleRepeat = () => {
    const order: RepeatMode[] = ['off', 'all', 'one'];
    const next = order[(order.indexOf(prefs.repeat) + 1) % order.length];
    setPrefs((p) => ({ ...p, repeat: next }));
    showToast(
      next === 'off' ? 'Repeat off' : next === 'all' ? 'Repeating queue' : 'Repeating current track'
    );
  };

  const viewTransitionKey = `${activeView}-${activeView === 'playlist' ? selectedPlaylistId || '' : ''}`;

  return (
    <MotionConfig reducedMotion="user">
      <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#0B0D10] text-[#F3F4F6]">
        {/* Main Workspace Area */}
        <div className="flex-1 flex min-h-0 overflow-hidden relative">
          <Sidebar
            activeView={activeView}
            activePlaylistId={selectedPlaylistId}
            playlists={playlists}
            likedCount={likedTracks.length}
            recentCount={recentTracks.length}
            cachedCount={onlineCache.length}
            isOpenMobile={mobileMenuOpen}
            onCloseMobile={() => setMobileMenuOpen(false)}
            onSelectView={(v) => {
              setActiveView(v);
            }}
            onSelectPlaylist={(id) => {
              setSelectedPlaylistId(id);
              setActiveView('playlist');
            }}
            onCreatePlaylist={() => setPlaylistModal({ open: true, mode: 'create' })}
          />

          {/* Center Content Column */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
            {/* Top Bar */}
            <header className="h-16 px-4 lg:px-8 border-b border-white/[0.06] bg-[#0B0D10]/95 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3 min-w-0 flex-1 max-w-xl">
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="Open navigation menu"
                  className="lg:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06]"
                >
                  <Menu size={18} />
                </button>

                {/* Global Online Search Bar */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (searchQuery.trim()) {
                      void searchOnline(searchQuery);
                    }
                  }}
                  className="relative w-full"
                >
                  <Search
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
                  />
                  <input
                    ref={searchInputRef}
                    type="search"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setOnlineQuery(e.target.value);
                    }}
                    placeholder="Search online songs and press Enter... ( / )"
                    aria-label="Search online songs"
                    className="w-full rounded-lg bg-[#141820] border border-white/[0.08] pl-9 pr-8 py-2 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#4169E1] transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setOnlineQuery('');
                      }}
                      aria-label="Clear search"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  )}
                </form>
              </div>

              {/* Right Zone: Network warning if offline + New Playlist Action */}
              <div className="flex items-center gap-3 shrink-0">
                {isOfflineNetwork && (
                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-amber-400 whitespace-nowrap">
                    <WifiOff size={14} />
                    <span>No Internet</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setPlaylistModal({ open: true, mode: 'create' })}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#161A22] hover:bg-[#1E232E] border border-white/10 text-xs font-medium text-zinc-100 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1]"
                >
                  <Plus size={14} className="text-[#6B8EFF]" />
                  <span>New Playlist</span>
                </button>
              </div>
            </header>

            {/* Scrollable Content Viewport */}
            <main className="flex-1 overflow-y-auto px-4 lg:px-8 py-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={viewTransitionKey}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-10"
                >
                  {/* VIEW: DISCOVER */}
                  {activeView === 'discover' && (
                    <>
                      {/* Dominant Focal Anchor: Online Stream Search Hero */}
                      <motion.section
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                        className="rounded-xl bg-[#12151A] border border-white/[0.07] p-6 lg:p-8 space-y-5"
                      >
                        <div className="space-y-2 max-w-2xl">
                          <div className="text-xs font-medium text-zinc-400">
                            Online Music Streaming · Instant Playback
                          </div>
                          <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-white text-balance">
                            Welcome to Muscify
                          </h1>
                          <p className="text-sm text-zinc-400 leading-relaxed">
                            Search artists, tracks, or albums to play immediately.
                          </p>
                        </div>

                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void searchOnline(onlineQuery);
                          }}
                          className="flex flex-col sm:flex-row gap-2.5 max-w-2xl"
                        >
                          <div className="relative flex-1">
                            <Search
                              size={15}
                              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
                            />
                            <input
                              type="text"
                              value={onlineQuery}
                              onChange={(e) => {
                                setOnlineQuery(e.target.value);
                                setSearchQuery(e.target.value);
                              }}
                              placeholder="Search any song, artist, or album..."
                              className="w-full rounded-lg bg-[#0B0D10] border border-white/10 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#4169E1] transition-colors"
                            />
                          </div>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.97 }}
                            transition={{ duration: 0.14 }}
                            type="submit"
                            disabled={!onlineQuery.trim() || onlineLoading}
                            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#4169E1] hover:bg-[#5478E8] disabled:opacity-40 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8EFF]"
                          >
                            <Globe size={15} />
                            <span>{onlineLoading ? 'Searching...' : 'Search Online'}</span>
                          </motion.button>
                        </form>

                        {apiConfigured === false && (
                          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 space-y-1 max-w-2xl">
                            <div className="text-xs font-semibold text-amber-200">
                              Configure API Key on the Server
                            </div>
                            <p className="text-xs text-amber-100/80 leading-relaxed">
                              Add your key as{' '}
                              <span className="font-mono-tabular text-amber-200">
                                YOUTUBE_API_KEY
                              </span>{' '}
                              in Settings → Secrets to enable online song search. Your key stays
                              strictly on the server.
                            </p>
                          </div>
                        )}
                      </motion.section>

                      {/* Trending in India — Bollywood Hindi Songs */}
                      <section className="space-y-4">
                        <div className="flex flex-wrap items-end justify-between gap-3">
                          <div>
                            <h2 className="font-display text-lg font-semibold text-white">
                              Trending in India
                            </h2>
                            <p className="text-xs text-zinc-400 mt-0.5">
                              Bollywood Hindi songs
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {trendingTracks.length > 0 && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => playTrack(trendingTracks[0], trendingTracks)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#4169E1] hover:bg-[#5478E8] text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
                                >
                                  <Play size={13} className="fill-current" />
                                  <span>Play All</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePlayShuffled(trendingTracks)}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-zinc-200 transition-colors whitespace-nowrap shrink-0"
                                >
                                  <Shuffle size={13} />
                                  <span>Shuffle</span>
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => void fetchTrendingIndia(true)}
                              disabled={trendingLoading}
                              aria-label="Refresh Trending in India"
                              className="p-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 hover:text-white disabled:opacity-40 transition-colors shrink-0"
                            >
                              <RotateCw
                                size={14}
                                className={trendingLoading ? 'animate-spin' : ''}
                              />
                            </button>
                          </div>
                        </div>

                        {trendingLoading ? (
                          <div className="space-y-2">
                            {Array.from({ length: 5 }).map((_, idx) => (
                              <div
                                key={idx}
                                className="h-14 rounded-lg bg-[#12151A] border border-white/[0.04] animate-pulse"
                              />
                            ))}
                          </div>
                        ) : trendingError ? (
                          <div className="rounded-xl border border-white/[0.07] bg-[#12151A] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <p className="text-xs text-zinc-400">
                              {apiConfigured === false
                                ? 'Configure YOUTUBE_API_KEY in Settings → Secrets to load Trending in India Bollywood Hindi songs.'
                                : trendingError}
                            </p>
                            <button
                              type="button"
                              onClick={() => void fetchTrendingIndia(true)}
                              className="px-3.5 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.12] text-xs font-medium text-white transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
                            >
                              Retry
                            </button>
                          </div>
                        ) : trendingTracks.length > 0 ? (
                          <TrackTable
                            tracks={trendingTracks}
                            currentTrackId={currentTrack?.id || null}
                            isPlaying={isPlaying}
                            likedIds={likedSet}
                            playlists={playlists}
                            onPlayTrack={playTrack}
                            onTogglePlayPause={handleTogglePlayClean}
                            onToggleLike={toggleLike}
                            onAddToQueue={addToQueue}
                            onAddToPlaylist={addTrackToPlaylist}
                            onCreatePlaylistWithTrack={(trackId) =>
                              setPlaylistModal({
                                open: true,
                                mode: 'create',
                                pendingTrackId: trackId,
                              })
                            }
                          />
                        ) : null}
                      </section>

                      {/* Recently Played Online Songs */}
                      {recentTracks.length > 0 && (
                        <section className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h2 className="font-display text-lg font-semibold text-white">
                                Jump Back In
                              </h2>
                              <p className="text-xs text-zinc-500 mt-0.5">
                                Recently played online tracks saved on this device
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setActiveView('recent')}
                              className="text-xs font-medium text-zinc-400 hover:text-white transition-colors whitespace-nowrap shrink-0"
                            >
                              View all
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                            {recentTracks.slice(0, 6).map((tr, idx) => {
                              const isActive = currentTrack?.id === tr.id;
                              return (
                                <motion.button
                                  key={tr.id}
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{
                                    duration: 0.16,
                                    delay: idx * 0.03,
                                    ease: [0.16, 1, 0.3, 1],
                                  }}
                                  whileHover={{ y: -2 }}
                                  whileTap={{ scale: 0.99 }}
                                  type="button"
                                  onClick={() => playTrack(tr, recentTracks)}
                                  className={`group flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${
                                    isActive
                                      ? 'bg-white/[0.07] border-[#4169E1]/40'
                                      : 'bg-[#12151A] border-white/[0.06] hover:bg-[#171B22]'
                                  }`}
                                >
                                  <CoverArt
                                    src={tr.coverUrl}
                                    alt={tr.title}
                                    className="w-12 h-12 rounded-md"
                                    iconSize={18}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div
                                      className={`text-sm font-medium truncate ${
                                        isActive ? 'text-[#6B8EFF]' : 'text-zinc-100'
                                      }`}
                                    >
                                      {tr.title}
                                    </div>
                                    <div className="text-xs text-zinc-400 truncate">
                                      {tr.artist} · {formatDuration(tr.duration)}
                                    </div>
                                  </div>
                                  <span className="w-8 h-8 rounded-full bg-[#4169E1] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                    <Play size={14} className="fill-current ml-0.5" />
                                  </span>
                                </motion.button>
                              );
                            })}
                          </div>
                        </section>
                      )}

                      {/* Saved / Cached Online Library */}
                      {onlineCache.length > 0 ? (
                        <section className="space-y-4">
                          <div className="flex flex-wrap items-end justify-between gap-3">
                            <div>
                              <h2 className="font-display text-lg font-semibold text-white">
                                Your Saved Online Tracks
                              </h2>
                              <p className="text-xs text-zinc-400 mt-0.5">
                                Online songs from your previous plays, likes, and playlists
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => playTrack(onlineCache[0], onlineCache)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#4169E1] hover:bg-[#5478E8] text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0"
                              >
                                <Play size={13} className="fill-current" />
                                <span>Play All</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePlayShuffled(onlineCache)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-zinc-200 transition-colors whitespace-nowrap shrink-0"
                              >
                                <Shuffle size={13} />
                                <span>Shuffle</span>
                              </button>
                            </div>
                          </div>

                          <TrackTable
                            tracks={onlineCache}
                            currentTrackId={currentTrack?.id || null}
                            isPlaying={isPlaying}
                            likedIds={likedSet}
                            playlists={playlists}
                            onPlayTrack={playTrack}
                            onTogglePlayPause={handleTogglePlayClean}
                            onToggleLike={toggleLike}
                            onAddToQueue={addToQueue}
                            onAddToPlaylist={addTrackToPlaylist}
                            onCreatePlaylistWithTrack={(trackId) =>
                              setPlaylistModal({
                                open: true,
                                mode: 'create',
                                pendingTrackId: trackId,
                              })
                            }
                          />
                        </section>
                      ) : (
                        !trendingLoading &&
                        trendingTracks.length === 0 && (
                          <section className="rounded-xl border border-white/[0.07] bg-[#12151A] p-10 text-center space-y-2.5">
                            <Globe size={28} className="mx-auto text-[#6B8EFF]" />
                            <h2 className="text-base font-semibold text-white">
                              No online tracks saved yet
                            </h2>
                            <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                              Use the search bar above to find and play any online song. Tracks you
                              play, like, or add to playlists are remembered automatically in your
                              browser.
                            </p>
                          </section>
                        )
                      )}
                    </>
                  )}

                  {/* VIEW: ONLINE SEARCH */}
                  {activeView === 'search' && (
                    <section className="space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-white/[0.06]">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-xl bg-[#4169E1]/15 border border-[#4169E1]/30 flex items-center justify-center shrink-0">
                            <Globe size={26} className="text-[#6B8EFF]" />
                          </div>
                          <div>
                            <div className="text-xs font-medium text-zinc-400">
                              Online Catalog
                            </div>
                            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white mt-0.5">
                              Online Search
                            </h1>
                            <p className="text-xs text-zinc-400 mt-1">
                              Stream online songs and save favorites or playlists directly to your
                              localStorage library.
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Online Search Form */}
                      <form onSubmit={handleOnlineFormSubmit} className="flex gap-2.5 max-w-2xl">
                        <div className="relative flex-1">
                          <Search
                            size={15}
                            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none"
                          />
                          <input
                            type="text"
                            value={onlineQuery}
                            onChange={(e) => {
                              setOnlineQuery(e.target.value);
                              setSearchQuery(e.target.value);
                            }}
                            placeholder="Search any song, artist, or album..."
                            className="w-full rounded-lg bg-[#12151A] border border-white/10 pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#4169E1] transition-colors"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={!onlineQuery.trim() || onlineLoading}
                          className="px-5 py-2.5 rounded-lg bg-[#4169E1] hover:bg-[#5478E8] disabled:opacity-40 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                        >
                          {onlineLoading ? 'Searching...' : 'Search'}
                        </button>
                      </form>

                      {/* Setup Notice if API key not yet set in Secrets */}
                      {(apiConfigured === false ||
                        onlineError?.code === 'YOUTUBE_API_KEY_MISSING') && (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5 space-y-2 max-w-2xl">
                          <div className="text-sm font-semibold text-amber-200">
                            Configure API Key on the Server
                          </div>
                          <p className="text-xs text-amber-100/80 leading-relaxed">
                            Add your key as{' '}
                            <span className="font-mono-tabular text-amber-200">
                              YOUTUBE_API_KEY
                            </span>{' '}
                            in Settings → Secrets to enable online song search. Your key stays
                            strictly on the server and is never exposed in the browser.
                          </p>
                        </div>
                      )}

                      {onlineError && onlineError.code !== 'YOUTUBE_API_KEY_MISSING' && (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200 max-w-2xl">
                          {onlineError.message}
                        </div>
                      )}

                      {/* Loading Skeleton */}
                      {onlineLoading && (
                        <div className="space-y-2">
                          {Array.from({ length: 6 }).map((_, idx) => (
                            <div
                              key={idx}
                              className="h-14 rounded-lg bg-[#12151A] border border-white/[0.04] animate-pulse"
                            />
                          ))}
                        </div>
                      )}

                      {/* Results Table */}
                      {!onlineLoading && onlineResults.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h2 className="text-sm font-semibold text-zinc-200">
                              Results for "{onlineQuery}"
                            </h2>
                            <button
                              type="button"
                              onClick={() => playTrack(onlineResults[0], onlineResults)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-white transition-colors"
                            >
                              <Play size={13} className="fill-current" />
                              <span>Play Results</span>
                            </button>
                          </div>

                          <TrackTable
                            tracks={onlineResults}
                            currentTrackId={currentTrack?.id || null}
                            isPlaying={isPlaying}
                            likedIds={likedSet}
                            playlists={playlists}
                            onPlayTrack={playTrack}
                            onTogglePlayPause={handleTogglePlayClean}
                            onToggleLike={toggleLike}
                            onAddToQueue={addToQueue}
                            onAddToPlaylist={addTrackToPlaylist}
                            onCreatePlaylistWithTrack={(trackId) =>
                              setPlaylistModal({
                                open: true,
                                mode: 'create',
                                pendingTrackId: trackId,
                              })
                            }
                          />
                        </div>
                      )}

                      {!onlineLoading && onlineResults.length === 0 && !onlineError && (
                        <div className="rounded-xl border border-white/[0.07] bg-[#12151A] p-10 text-center space-y-2">
                          <p className="text-sm text-zinc-300">
                            Search above to find and stream tracks online.
                          </p>
                          <p className="text-xs text-zinc-500">
                            Any track you like, play, or add to a playlist is automatically saved in
                            localStorage.
                          </p>
                        </div>
                      )}
                    </section>
                  )}

                  {/* VIEW: LIKED SONGS */}
                  {activeView === 'liked' && (
                    <section className="space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-white/[0.06]">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#4169E1]/30 to-[#2746B0]/10 border border-[#4169E1]/30 flex items-center justify-center shrink-0">
                            <Heart size={28} className="text-[#6B8EFF] fill-[#6B8EFF]" />
                          </div>
                          <div>
                            <div className="text-xs font-medium text-zinc-400">
                              Saved in LocalStorage
                            </div>
                            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white mt-0.5">
                              Liked Songs
                            </h1>
                            <div className="text-xs text-zinc-400 mt-1 font-mono-tabular">
                              {likedTracks.length}{' '}
                              {likedTracks.length === 1 ? 'track' : 'tracks'} ·{' '}
                              {formatDuration(
                                likedTracks.reduce((acc, t) => acc + t.duration, 0)
                              )}
                            </div>
                          </div>
                        </div>

                        {likedTracks.length > 0 && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => playTrack(likedTracks[0], likedTracks)}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4169E1] hover:bg-[#5478E8] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                            >
                              <Play size={14} className="fill-current" />
                              <span>Play Liked</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePlayShuffled(likedTracks)}
                              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-zinc-200 transition-colors whitespace-nowrap shrink-0"
                            >
                              <Shuffle size={14} />
                              <span>Shuffle</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {likedTracks.length === 0 ? (
                        <div className="rounded-xl border border-white/[0.07] bg-[#12151A] p-12 text-center space-y-3">
                          <Heart size={28} className="mx-auto text-zinc-600" />
                          <h2 className="text-base font-semibold text-white">No liked songs yet</h2>
                          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                            Tap the heart icon on any online track to keep it here in your browser
                            storage for quick access.
                          </p>
                          <button
                            type="button"
                            onClick={() => setActiveView('search')}
                            className="mt-2 px-4 py-2 rounded-lg bg-[#4169E1] hover:bg-[#5478E8] text-white text-xs font-semibold transition-colors"
                          >
                            Search Online Songs
                          </button>
                        </div>
                      ) : (
                        <TrackTable
                          tracks={likedTracks}
                          currentTrackId={currentTrack?.id || null}
                          isPlaying={isPlaying}
                          likedIds={likedSet}
                          playlists={playlists}
                          onPlayTrack={playTrack}
                          onTogglePlayPause={handleTogglePlayClean}
                          onToggleLike={toggleLike}
                          onAddToQueue={addToQueue}
                          onAddToPlaylist={addTrackToPlaylist}
                          onCreatePlaylistWithTrack={(trackId) =>
                            setPlaylistModal({
                              open: true,
                              mode: 'create',
                              pendingTrackId: trackId,
                            })
                          }
                        />
                      )}
                    </section>
                  )}

                  {/* VIEW: RECENTLY PLAYED */}
                  {activeView === 'recent' && (
                    <section className="space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-white/[0.06]">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-xl bg-[#161A22] border border-white/10 flex items-center justify-center shrink-0">
                            <Clock size={26} className="text-zinc-300" />
                          </div>
                          <div>
                            <div className="text-xs font-medium text-zinc-400">
                              Listening History
                            </div>
                            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white mt-0.5">
                              Recently Played
                            </h1>
                            <div className="text-xs text-zinc-400 mt-1 font-mono-tabular">
                              {recentTracks.length}{' '}
                              {recentTracks.length === 1 ? 'track' : 'tracks'} logged
                            </div>
                          </div>
                        </div>

                        {recentTracks.length > 0 && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => playTrack(recentTracks[0], recentTracks)}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4169E1] hover:bg-[#5478E8] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                            >
                              <Play size={14} className="fill-current" />
                              <span>Resume Latest</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setConfirmState({
                                  open: true,
                                  title: 'Clear listening history?',
                                  message:
                                    'This clears your recently played log from localStorage. Your liked songs and playlists remain intact.',
                                  confirmLabel: 'Clear History',
                                  onConfirm: () => {
                                    setRecentPlays([]);
                                    showToast('Cleared recently played history');
                                  },
                                })
                              }
                              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-zinc-300 transition-colors whitespace-nowrap shrink-0"
                            >
                              <Trash2 size={14} />
                              <span>Clear History</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {recentTracks.length === 0 ? (
                        <div className="rounded-xl border border-white/[0.07] bg-[#12151A] p-12 text-center space-y-3">
                          <Clock size={28} className="mx-auto text-zinc-600" />
                          <h2 className="text-base font-semibold text-white">
                            No recent playback yet
                          </h2>
                          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                            Online tracks you listen to are automatically logged here in
                            localStorage so you can pick up right where you left off.
                          </p>
                          <button
                            type="button"
                            onClick={() => setActiveView('search')}
                            className="mt-2 px-4 py-2 rounded-lg bg-[#4169E1] hover:bg-[#5478E8] text-white text-xs font-semibold transition-colors"
                          >
                            Search Online Songs
                          </button>
                        </div>
                      ) : (
                        <TrackTable
                          tracks={recentTracks}
                          currentTrackId={currentTrack?.id || null}
                          isPlaying={isPlaying}
                          likedIds={likedSet}
                          playlists={playlists}
                          recentMap={recentMap}
                          showRecentColumn
                          onPlayTrack={playTrack}
                          onTogglePlayPause={handleTogglePlayClean}
                          onToggleLike={toggleLike}
                          onAddToQueue={addToQueue}
                          onAddToPlaylist={addTrackToPlaylist}
                          onCreatePlaylistWithTrack={(trackId) =>
                            setPlaylistModal({
                              open: true,
                              mode: 'create',
                              pendingTrackId: trackId,
                            })
                          }
                        />
                      )}
                    </section>
                  )}

                  {/* VIEW: PLAYLIST DETAIL */}
                  {activeView === 'playlist' && activePlaylist && (
                    <section className="space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-white/[0.06]">
                        <div className="flex items-start gap-4">
                          <div className="w-20 h-20 rounded-xl bg-[#161A22] border border-white/10 flex items-center justify-center shrink-0">
                            <ListMusic size={30} className="text-[#6B8EFF]" />
                          </div>
                          <div>
                            <div className="text-xs font-medium text-zinc-400">
                              Personal Playlist
                            </div>
                            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white mt-0.5">
                              {activePlaylist.name}
                            </h1>
                            {activePlaylist.description && (
                              <p className="text-xs text-zinc-400 mt-1 max-w-xl">
                                {activePlaylist.description}
                              </p>
                            )}
                            <div className="text-xs text-zinc-500 mt-1.5 font-mono-tabular">
                              {activePlaylistTracks.length}{' '}
                              {activePlaylistTracks.length === 1 ? 'track' : 'tracks'} ·{' '}
                              {formatDuration(
                                activePlaylistTracks.reduce((acc, t) => acc + t.duration, 0)
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {activePlaylistTracks.length > 0 && (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  playTrack(activePlaylistTracks[0], activePlaylistTracks)
                                }
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#4169E1] hover:bg-[#5478E8] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                              >
                                <Play size={14} className="fill-current" />
                                <span>Play</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePlayShuffled(activePlaylistTracks)}
                                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-zinc-200 transition-colors whitespace-nowrap shrink-0"
                              >
                                <Shuffle size={14} />
                                <span>Shuffle</span>
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setPlaylistModal({
                                open: true,
                                mode: 'rename',
                                playlistId: activePlaylist.id,
                              })
                            }
                            aria-label="Edit playlist details"
                            className="p-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-zinc-300 transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmState({
                                open: true,
                                title: `Delete "${activePlaylist.name}"?`,
                                message:
                                  'The playlist will be removed from localStorage. Your liked songs and history remain intact.',
                                confirmLabel: 'Delete Playlist',
                                onConfirm: () => {
                                  setPlaylists((prev) =>
                                    prev.filter((p) => p.id !== activePlaylist.id)
                                  );
                                  setActiveView('discover');
                                  setSelectedPlaylistId(null);
                                  showToast(`Deleted playlist "${activePlaylist.name}"`);
                                },
                              })
                            }
                            aria-label="Delete playlist"
                            className="p-2 rounded-lg bg-white/[0.05] hover:bg-red-500/15 text-zinc-400 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {activePlaylistTracks.length === 0 ? (
                        <div className="rounded-xl border border-white/[0.07] bg-[#12151A] p-12 text-center space-y-3">
                          <Plus size={26} className="mx-auto text-zinc-600" />
                          <h2 className="text-base font-semibold text-white">
                            This playlist is empty
                          </h2>
                          <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                            Use the options menu on any online track to add it to "
                            {activePlaylist.name}".
                          </p>
                          <button
                            type="button"
                            onClick={() => setActiveView('search')}
                            className="mt-2 px-4 py-2 rounded-lg bg-[#4169E1] hover:bg-[#5478E8] text-white text-xs font-semibold transition-colors"
                          >
                            Search Online Songs
                          </button>
                        </div>
                      ) : (
                        <TrackTable
                          tracks={activePlaylistTracks}
                          currentTrackId={currentTrack?.id || null}
                          isPlaying={isPlaying}
                          likedIds={likedSet}
                          playlists={playlists}
                          onPlayTrack={playTrack}
                          onTogglePlayPause={handleTogglePlayClean}
                          onToggleLike={toggleLike}
                          onAddToQueue={addToQueue}
                          onAddToPlaylist={addTrackToPlaylist}
                          onCreatePlaylistWithTrack={(trackId) =>
                            setPlaylistModal({
                              open: true,
                              mode: 'create',
                              pendingTrackId: trackId,
                            })
                          }
                          onRemoveFromView={(trackId) =>
                            removeTrackFromPlaylist(activePlaylist.id, trackId)
                          }
                          removeActionLabel="Remove from Playlist"
                        />
                      )}
                    </section>
                  )}
                </motion.div>
              </AnimatePresence>
            </main>

            {/* Hidden Online Stream Player Host (kept off-screen for audio-only playback) */}
            <div
              aria-hidden="true"
              className="fixed -left-[9999px] -top-[9999px] w-[200px] h-[200px] opacity-0 pointer-events-none overflow-hidden"
            >
              <div id="youtube-player-host" className="w-full h-full" />
            </div>
          </div>

          {/* Slide-Over Up Next Queue Drawer */}
          <QueueDrawer
            isOpen={isQueueOpen}
            currentTrack={currentTrack}
            upNextTracks={upNextTracks}
            onClose={() => setIsQueueOpen(false)}
            onPlayFromQueue={(offset) => {
              const targetIndex = queueIndex + 1 + offset;
              const target = queue[targetIndex];
              if (target) {
                setQueueIndex(targetIndex);
                setCurrentTrack(target);
                setCurrentTime(0);
                setDuration(target.duration);
                setIsPlaying(true);
                recordRecentPlay(target.id);
                startOnlinePlayback(target, 0);
              }
            }}
            onRemoveFromQueue={(offset) => {
              const targetIndex = queueIndex + 1 + offset;
              setQueue((prev) => prev.filter((_, idx) => idx !== targetIndex));
            }}
            onClearQueue={() => {
              if (currentTrack) {
                setQueue([currentTrack]);
                setQueueIndex(0);
              } else {
                setQueue([]);
                setQueueIndex(0);
              }
              showToast('Cleared Up Next queue');
            }}
          />
        </div>

        {/* Persistent Bottom Playback Bar */}
        <PlayerBar
          track={currentTrack}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          volume={prefs.volume}
          muted={prefs.muted}
          shuffle={prefs.shuffle}
          repeat={prefs.repeat}
          isLiked={currentTrack ? likedSet.has(currentTrack.id) : false}
          queueLength={upNextTracks.length}
          isQueueOpen={isQueueOpen}
          onTogglePlay={handleTogglePlayClean}
          onPrev={handlePrev}
          onNext={handleNext}
          onSeek={(sec) => {
            setCurrentTime(sec);
            if (hasLoadedOnceRef.current === currentTrack?.id) {
              ytBridgeRef.current?.seek(sec);
            }
          }}
          onVolumeChange={(val) => {
            setPrefs((p) => ({ ...p, volume: val, muted: val === 0 }));
            ytBridgeRef.current?.setVolume(val);
            ytBridgeRef.current?.setMuted(val === 0);
          }}
          onToggleMute={() => {
            const nextMuted = !prefs.muted;
            setPrefs((p) => ({ ...p, muted: nextMuted }));
            ytBridgeRef.current?.setMuted(nextMuted);
          }}
          onToggleShuffle={() => {
            const nextShuffle = !prefs.shuffle;
            setPrefs((p) => ({ ...p, shuffle: nextShuffle }));
            showToast(nextShuffle ? 'Shuffle enabled' : 'Shuffle disabled');
          }}
          onCycleRepeat={cycleRepeat}
          onToggleLike={toggleLike}
          onToggleQueue={() => setIsQueueOpen((o) => !o)}
        />

        {/* Create / Rename Playlist Modal */}
        <PlaylistModal
          isOpen={playlistModal.open}
          mode={playlistModal.mode}
          initialName={
            playlistModal.mode === 'rename' && playlistModal.playlistId
              ? playlists.find((p) => p.id === playlistModal.playlistId)?.name || ''
              : ''
          }
          initialDescription={
            playlistModal.mode === 'rename' && playlistModal.playlistId
              ? playlists.find((p) => p.id === playlistModal.playlistId)?.description || ''
              : ''
          }
          onClose={() => setPlaylistModal({ open: false, mode: 'create' })}
          onSubmit={(name, description) => {
            if (playlistModal.mode === 'create') {
              const newId = `pl-${Date.now()}`;
              const newPlaylist: Playlist = {
                id: newId,
                name,
                description,
                trackIds: playlistModal.pendingTrackId ? [playlistModal.pendingTrackId] : [],
                createdAt: Date.now(),
              };
              setPlaylists((prev) => [newPlaylist, ...prev]);
              setSelectedPlaylistId(newId);
              setActiveView('playlist');
              showToast(`Created playlist "${name}"`);
            } else if (playlistModal.playlistId) {
              setPlaylists((prev) =>
                prev.map((pl) =>
                  pl.id === playlistModal.playlistId ? { ...pl, name, description } : pl
                )
              );
              showToast(`Updated playlist "${name}"`);
            }
          }}
        />

        {/* Confirmation Dialog */}
        <ConfirmModal
          isOpen={confirmState.open}
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState((s) => ({ ...s, open: false }))}
        />

        {/* Toast Feedback */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              key={toastMessage}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              role="status"
              aria-live="polite"
              className="fixed bottom-32 md:bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-[#1C212A] border border-white/15 shadow-2xl text-xs font-medium text-white whitespace-nowrap"
            >
              {toastMessage}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
