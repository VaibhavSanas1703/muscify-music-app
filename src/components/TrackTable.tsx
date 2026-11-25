import {
  Check,
  Heart,
  ListPlus,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Trash2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Playlist, RecentPlayEntry, Track } from '../types/music';
import { formatDuration, formatRelativeTime } from '../utils/format';
import { CoverArt } from './CoverArt';

interface TrackTableProps {
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  likedIds: Set<string>;
  playlists: Playlist[];
  recentMap?: Map<string, RecentPlayEntry>;
  showRecentColumn?: boolean;
  onPlayTrack: (track: Track, contextTracks: Track[]) => void;
  onTogglePlayPause: () => void;
  onToggleLike: (trackId: string) => void;
  onAddToQueue: (track: Track) => void;
  onAddToPlaylist: (playlistId: string, trackId: string) => void;
  onCreatePlaylistWithTrack: (trackId: string) => void;
  onRemoveFromView?: (trackId: string) => void;
  removeActionLabel?: string;
}

export function TrackTable({
  tracks,
  currentTrackId,
  isPlaying,
  likedIds,
  playlists,
  recentMap,
  showRecentColumn = false,
  onPlayTrack,
  onTogglePlayPause,
  onToggleLike,
  onAddToQueue,
  onAddToPlaylist,
  onCreatePlaylistWithTrack,
  onRemoveFromView,
  removeActionLabel = 'Remove',
}: TrackTableProps) {
  const [openMenuTrackId, setOpenMenuTrackId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openMenuTrackId) return;
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuTrackId(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [openMenuTrackId]);

  if (tracks.length === 0) {
    return null;
  }

  return (
    <div className="w-full overflow-visible">
      {/* Header Row */}
      <div className="grid grid-cols-[36px_minmax(0,1fr)_auto] md:grid-cols-[40px_minmax(0,2fr)_minmax(0,1.1fr)_90px_116px] items-center gap-3 px-3 py-2 text-xs font-medium text-zinc-500 border-b border-white/[0.06]">
        <div className="text-center">#</div>
        <div>Title</div>
        <div className="hidden md:block">
          {showRecentColumn ? 'Last Played' : 'Channel / Source'}
        </div>
        <div className="hidden md:block text-right">Year</div>
        <div className="text-right pr-2">Duration</div>
      </div>

      {/* Track Rows */}
      <div className="divide-y divide-white/[0.04]">
        {tracks.map((track, idx) => {
          const isCurrent = track.id === currentTrackId;
          const isTrackPlaying = isCurrent && isPlaying;
          const isLiked = likedIds.has(track.id);
          const recentEntry = recentMap?.get(track.id);

          return (
            <motion.div
              key={`${track.id}-${idx}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.18,
                delay: Math.min(idx * 0.018, 0.2),
                ease: [0.16, 1, 0.3, 1],
              }}
              onDoubleClick={() => {
                if (isCurrent) onTogglePlayPause();
                else onPlayTrack(track, tracks);
              }}
              className={`group relative grid grid-cols-[36px_minmax(0,1fr)_auto] md:grid-cols-[40px_minmax(0,2fr)_minmax(0,1.1fr)_90px_116px] items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                isCurrent ? 'bg-white/[0.06]' : 'hover:bg-white/[0.035]'
              }`}
            >
              {/* Index / Play Trigger */}
              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => {
                    if (isCurrent) onTogglePlayPause();
                    else onPlayTrack(track, tracks);
                  }}
                  aria-label={isTrackPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
                  className="w-8 h-8 flex items-center justify-center rounded-md text-zinc-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1]"
                >
                  {isTrackPlaying ? (
                    <>
                      <span
                        className="group-hover:hidden flex items-end gap-0.5 h-3.5"
                        aria-hidden="true"
                      >
                        <motion.span
                          animate={{ scaleY: [0.35, 1, 0.45, 0.9, 0.35] }}
                          transition={{ repeat: Infinity, duration: 0.9, ease: 'easeInOut' }}
                          className="w-0.5 h-3.5 origin-bottom bg-[#4169E1] rounded-full"
                        />
                        <motion.span
                          animate={{ scaleY: [0.85, 0.3, 1, 0.4, 0.85] }}
                          transition={{ repeat: Infinity, duration: 0.75, ease: 'easeInOut' }}
                          className="w-0.5 h-3.5 origin-bottom bg-[#4169E1] rounded-full"
                        />
                        <motion.span
                          animate={{ scaleY: [0.45, 0.95, 0.35, 1, 0.45] }}
                          transition={{ repeat: Infinity, duration: 0.82, ease: 'easeInOut' }}
                          className="w-0.5 h-3.5 origin-bottom bg-[#4169E1] rounded-full"
                        />
                      </span>
                      <Pause size={15} className="hidden group-hover:block text-[#6B8EFF]" />
                    </>
                  ) : (
                    <>
                      <span
                        className={`font-mono-tabular text-xs group-hover:hidden ${
                          isCurrent ? 'text-[#6B8EFF] font-semibold' : 'text-zinc-500'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <Play size={15} className="hidden group-hover:block text-white fill-white" />
                    </>
                  )}
                </button>
              </div>

              {/* Cover + Title + Artist */}
              <div className="flex items-center gap-3 min-w-0">
                <CoverArt
                  src={track.coverUrl}
                  alt={`${track.title} cover`}
                  className="w-10 h-10 rounded-md"
                  iconSize={16}
                />
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (isCurrent) onTogglePlayPause();
                      else onPlayTrack(track, tracks);
                    }}
                    className={`block w-full text-left text-sm font-medium truncate transition-colors ${
                      isCurrent ? 'text-[#6B8EFF]' : 'text-zinc-100 hover:text-white'
                    }`}
                  >
                    {track.title}
                  </button>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400 truncate">
                    <span className="truncate">{track.artist}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-zinc-500 shrink-0">Online Stream</span>
                  </div>
                </div>
              </div>

              {/* Channel or Recent Column */}
              <div className="hidden md:flex items-center min-w-0 text-xs text-zinc-400">
                {showRecentColumn && recentEntry ? (
                  <span className="truncate text-zinc-400">
                    {formatRelativeTime(recentEntry.playedAt)}
                    <span className="text-zinc-600 mx-1.5">·</span>
                    <span className="font-mono-tabular text-zinc-500">
                      {recentEntry.playCount} {recentEntry.playCount === 1 ? 'play' : 'plays'}
                    </span>
                  </span>
                ) : (
                  <span className="truncate text-zinc-400">{track.artist}</span>
                )}
              </div>

              {/* Year */}
              <div className="hidden md:block text-right font-mono-tabular text-xs text-zinc-500 whitespace-nowrap">
                {track.year}
              </div>

              {/* Actions + Duration */}
              <div className="flex items-center justify-end gap-1">
                <motion.button
                  whileTap={{ scale: 0.78 }}
                  animate={{ scale: isLiked ? [1, 1.24, 1] : 1 }}
                  transition={{ duration: 0.18 }}
                  type="button"
                  onClick={() => onToggleLike(track.id)}
                  aria-label={
                    isLiked ? `Remove ${track.title} from Liked Songs` : `Like ${track.title}`
                  }
                  className={`p-2 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] ${
                    isLiked
                      ? 'text-[#4169E1] hover:text-[#6B8EFF]'
                      : 'text-zinc-500 opacity-70 sm:opacity-0 group-hover:opacity-100 hover:text-white'
                  }`}
                >
                  <Heart size={15} className={isLiked ? 'fill-[#4169E1]' : ''} />
                </motion.button>

                <span className="font-mono-tabular text-xs text-zinc-400 w-10 text-right shrink-0">
                  {formatDuration(track.duration)}
                </span>

                {/* Row Context Menu */}
                <div
                  className="relative"
                  ref={openMenuTrackId === track.id ? menuRef : undefined}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenMenuTrackId((prev) => (prev === track.id ? null : track.id))
                    }
                    aria-label={`More options for ${track.title}`}
                    className="p-2 rounded-md text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1]"
                  >
                    <MoreHorizontal size={15} />
                  </button>

                  <AnimatePresence>
                    {openMenuTrackId === track.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute right-0 top-9 z-30 w-52 origin-top-right rounded-lg bg-[#161A21] border border-white/10 shadow-2xl py-1.5 text-xs text-zinc-200"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onAddToQueue(track);
                            setOpenMenuTrackId(null);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-white/[0.06] transition-colors"
                        >
                          <ListPlus size={14} className="text-zinc-400" />
                          <span>Add to Up Next Queue</span>
                        </button>

                        <div className="my-1 border-t border-white/[0.06]" />
                        <div className="px-3 py-1 text-[11px] font-medium text-zinc-500">
                          Add to Playlist
                        </div>

                        {playlists.map((pl) => {
                          const alreadyIn = pl.trackIds.includes(track.id);
                          return (
                            <button
                              key={pl.id}
                              type="button"
                              onClick={() => {
                                onAddToPlaylist(pl.id, track.id);
                                setOpenMenuTrackId(null);
                              }}
                              className="w-full flex items-center justify-between gap-2 px-3 py-1.5 text-left hover:bg-white/[0.06] transition-colors"
                            >
                              <span className="truncate">{pl.name}</span>
                              {alreadyIn && <Check size={13} className="text-[#6B8EFF] shrink-0" />}
                            </button>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuTrackId(null);
                            onCreatePlaylistWithTrack(track.id);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[#6B8EFF] hover:bg-white/[0.06] transition-colors"
                        >
                          <Plus size={13} />
                          <span>New Playlist...</span>
                        </button>

                        {onRemoveFromView && (
                          <>
                            <div className="my-1 border-t border-white/[0.06]" />
                            <button
                              type="button"
                              onClick={() => {
                                onRemoveFromView(track.id);
                                setOpenMenuTrackId(null);
                              }}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 size={14} />
                              <span>{removeActionLabel}</span>
                            </button>
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
