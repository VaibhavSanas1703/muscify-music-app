import { Play, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Track } from '../types/music';
import { formatDuration } from '../utils/format';
import { CoverArt } from './CoverArt';

interface QueueDrawerProps {
  isOpen: boolean;
  currentTrack: Track | null;
  upNextTracks: Track[];
  onClose: () => void;
  onPlayFromQueue: (indexInUpNext: number) => void;
  onRemoveFromQueue: (indexInUpNext: number) => void;
  onClearQueue: () => void;
}

export function QueueDrawer({
  isOpen,
  currentTrack,
  upNextTracks,
  onClose,
  onPlayFromQueue,
  onRemoveFromQueue,
  onClearQueue,
}: QueueDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.aside
          initial={{ x: '100%', opacity: 0.6 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0.6 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          aria-label="Playback Queue"
          className="fixed inset-x-0 sm:inset-x-auto sm:right-0 top-0 bottom-[106px] md:bottom-20 z-40 w-full sm:w-96 bg-[#101318] border-l border-white/[0.08] shadow-2xl flex flex-col"
        >
          <div className="h-16 px-5 border-b border-white/[0.06] flex items-center justify-between shrink-0">
            <h2 className="font-display text-base font-semibold text-white">Up Next Queue</h2>
            <div className="flex items-center gap-2">
              {upNextTracks.length > 0 && (
                <button
                  type="button"
                  onClick={onClearQueue}
                  className="px-2.5 py-1 rounded-md text-xs font-medium text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors whitespace-nowrap"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close queue drawer"
                className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {/* Now Playing */}
            <div>
              <div className="text-xs font-medium text-zinc-500 mb-2.5">Now Playing</div>
              {currentTrack ? (
                <motion.div
                  key={currentTrack.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.16 }}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.05] border border-white/[0.06]"
                >
                  <CoverArt
                    src={currentTrack.coverUrl}
                    alt={currentTrack.album}
                    className="w-11 h-11 rounded-md"
                    iconSize={16}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-[#6B8EFF] truncate">
                      {currentTrack.title}
                    </div>
                    <div className="text-xs text-zinc-400 truncate">{currentTrack.artist}</div>
                  </div>
                  <span className="font-mono-tabular text-xs text-zinc-500 shrink-0">
                    {formatDuration(currentTrack.duration)}
                  </span>
                </motion.div>
              ) : (
                <p className="text-xs text-zinc-500">Nothing playing right now.</p>
              )}
            </div>

            {/* Up Next */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-medium text-zinc-500">Up Next</span>
                <span className="font-mono-tabular text-xs text-zinc-600">
                  {upNextTracks.length} {upNextTracks.length === 1 ? 'track' : 'tracks'}
                </span>
              </div>

              {upNextTracks.length === 0 ? (
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-5 text-center">
                  <p className="text-xs text-zinc-400">Your queue is empty.</p>
                  <p className="text-xs text-zinc-600 mt-1">
                    Add tracks from the menu or start playing an album.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <AnimatePresence initial={false}>
                    {upNextTracks.map((track, idx) => (
                      <motion.div
                        key={`${track.id}-${idx}`}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -12 }}
                        transition={{ duration: 0.16 }}
                        className="group flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.04] transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => onPlayFromQueue(idx)}
                          className="relative w-9 h-9 rounded overflow-hidden shrink-0"
                          aria-label={`Play ${track.title}`}
                        >
                          <CoverArt
                            src={track.coverUrl}
                            alt={track.album}
                            className="w-9 h-9 rounded"
                            iconSize={14}
                          />
                          <span className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Play size={14} className="text-white fill-white" />
                          </span>
                        </button>

                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => onPlayFromQueue(idx)}
                            className="block w-full text-left text-sm text-zinc-200 hover:text-white truncate"
                          >
                            {track.title}
                          </button>
                          <div className="text-xs text-zinc-500 truncate">{track.artist}</div>
                        </div>

                        <span className="font-mono-tabular text-xs text-zinc-500 shrink-0">
                          {formatDuration(track.duration)}
                        </span>

                        <button
                          type="button"
                          onClick={() => onRemoveFromQueue(idx)}
                          aria-label={`Remove ${track.title} from queue`}
                          className="p-1.5 rounded text-zinc-500 opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
