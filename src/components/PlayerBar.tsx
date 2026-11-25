import {
  Heart,
  ListOrdered,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { RepeatMode, Track } from '../types/music';
import { formatDuration } from '../utils/format';
import { CoverArt } from './CoverArt';

interface PlayerBarProps {
  track: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  isLiked: boolean;
  queueLength: number;
  isQueueOpen: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (seconds: number) => void;
  onVolumeChange: (val: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onToggleLike: (trackId: string) => void;
  onToggleQueue: () => void;
}

export function PlayerBar({
  track,
  isPlaying,
  currentTime,
  duration,
  volume,
  muted,
  shuffle,
  repeat,
  isLiked,
  queueLength,
  isQueueOpen,
  onTogglePlay,
  onPrev,
  onNext,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onCycleRepeat,
  onToggleLike,
  onToggleQueue,
}: PlayerBarProps) {
  const safeDuration = duration > 0 ? duration : track?.duration || 0;
  const progressPct = safeDuration > 0 ? Math.min(100, (currentTime / safeDuration) * 100) : 0;

  return (
    <footer className="relative bg-[#101318] border-t border-white/[0.08] shrink-0 z-30">
      {/* Mobile Layout (< md): Top flush seek bar + aligned 2-row controls */}
      <div className="md:hidden">
        {/* Flush Top Interactive Progress Bar */}
        <div className="relative w-full h-1 bg-white/10">
          <div
            className="h-full bg-[#4169E1] transition-[width] duration-150"
            style={{ width: `${progressPct}%` }}
          />
          <input
            type="range"
            min={0}
            max={safeDuration || 1}
            step={0.5}
            value={Math.min(currentTime, safeDuration)}
            disabled={!track}
            onChange={(e) => onSeek(Number(e.target.value))}
            aria-label="Seek playback position"
            className="absolute -top-2 inset-x-0 w-full h-5 opacity-0 cursor-pointer disabled:cursor-default z-10"
          />
        </div>

        <div className="px-3 py-2 space-y-1.5">
          {/* Row 1: Track Identity + Like + Queue */}
          <div className="flex items-center justify-between gap-2.5 min-h-[42px]">
            <AnimatePresence mode="wait">
              {track ? (
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -3 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center gap-2.5 min-w-0 flex-1"
                >
                  <CoverArt
                    src={track.coverUrl}
                    alt={`${track.title} cover`}
                    className="w-10 h-10 rounded-md"
                    iconSize={16}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white truncate">{track.title}</div>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400 truncate">
                      <span className="truncate">{track.artist}</span>
                      <span className="text-zinc-600 shrink-0" aria-hidden="true">
                        ·
                      </span>
                      <span className="font-mono-tabular text-[11px] text-zinc-500 shrink-0">
                        {formatDuration(currentTime)} / {formatDuration(safeDuration)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="text-xs text-zinc-500 truncate flex-1">
                  Search and select an online song to play
                </div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-0.5 shrink-0">
              {track && (
                <motion.button
                  whileTap={{ scale: 0.8 }}
                  type="button"
                  onClick={() => onToggleLike(track.id)}
                  aria-label={isLiked ? 'Unlike current track' : 'Like current track'}
                  className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] ${
                    isLiked ? 'text-[#4169E1]' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Heart size={17} className={isLiked ? 'fill-[#4169E1]' : ''} />
                </motion.button>
              )}

              <motion.button
                whileTap={{ scale: 0.92 }}
                type="button"
                onClick={onToggleQueue}
                aria-label="Toggle Up Next Queue"
                aria-expanded={isQueueOpen}
                className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] ${
                  isQueueOpen
                    ? 'bg-white/10 text-[#6B8EFF]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <ListOrdered size={17} />
              </motion.button>
            </div>
          </div>

          {/* Row 2: Balanced Transport Controls */}
          <div className="flex items-center justify-between px-2">
            <motion.button
              whileTap={{ scale: 0.88 }}
              type="button"
              onClick={onToggleShuffle}
              aria-label="Toggle shuffle"
              aria-pressed={shuffle}
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] ${
                shuffle ? 'text-[#6B8EFF]' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Shuffle size={16} />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.88 }}
              type="button"
              onClick={onPrev}
              disabled={!track}
              aria-label="Previous track"
              className="w-10 h-10 flex items-center justify-center rounded-lg text-zinc-200 hover:text-white disabled:opacity-30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1]"
            >
              <SkipBack size={19} className="fill-current" />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.92 }}
              type="button"
              onClick={onTogglePlay}
              disabled={!track}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="w-10 h-10 rounded-full bg-[#4169E1] hover:bg-[#5478E8] text-white flex items-center justify-center transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8EFF]"
            >
              {isPlaying ? (
                <Pause size={18} className="fill-current" />
              ) : (
                <Play size={18} className="fill-current ml-0.5" />
              )}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.88 }}
              type="button"
              onClick={onNext}
              disabled={!track}
              aria-label="Next track"
              className="w-10 h-10 flex items-center justify-center rounded-lg text-zinc-200 hover:text-white disabled:opacity-30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1]"
            >
              <SkipForward size={19} className="fill-current" />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.88 }}
              type="button"
              onClick={onCycleRepeat}
              aria-label={`Repeat mode: ${repeat}`}
              className={`w-10 h-10 flex items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] ${
                repeat !== 'off' ? 'text-[#6B8EFF]' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {repeat === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Desktop Layout (>= md): Balanced 3-zone grid */}
      <div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)] items-center gap-4 h-20 px-6">
        {/* Left: Active Track Identity */}
        <div className="flex items-center gap-3 min-w-0">
          <AnimatePresence mode="wait">
            {track ? (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-3 min-w-0 flex-1"
              >
                <motion.div
                  animate={{ scale: isPlaying ? 1 : 0.96 }}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="shrink-0"
                >
                  <CoverArt
                    src={track.coverUrl}
                    alt={`${track.title} cover`}
                    className="w-12 h-12 rounded-md"
                    iconSize={18}
                  />
                </motion.div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white truncate">{track.title}</div>
                  <div className="text-xs text-zinc-400 truncate">
                    {track.artist}
                    <span className="mx-1.5 text-zinc-600" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-zinc-500">Online</span>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.78 }}
                  animate={{ scale: isLiked ? [1, 1.22, 1] : 1 }}
                  transition={{ duration: 0.2 }}
                  type="button"
                  onClick={() => onToggleLike(track.id)}
                  aria-label={isLiked ? 'Unlike current track' : 'Like current track'}
                  className={`p-2 rounded-md transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] ${
                    isLiked ? 'text-[#4169E1]' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Heart size={16} className={isLiked ? 'fill-[#4169E1]' : ''} />
                </motion.button>
              </motion.div>
            ) : (
              <div className="text-xs text-zinc-500 truncate">
                Search and select an online song to play
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Center: Transport + Scrub Bar */}
        <div className="w-full max-w-xl mx-auto flex flex-col items-center gap-1.5 min-w-0">
          <div className="flex items-center gap-4">
            <motion.button
              whileTap={{ scale: 0.88 }}
              type="button"
              onClick={onToggleShuffle}
              aria-label="Toggle shuffle"
              aria-pressed={shuffle}
              className={`p-2 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] ${
                shuffle ? 'text-[#6B8EFF]' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Shuffle size={15} />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.88 }}
              type="button"
              onClick={onPrev}
              disabled={!track}
              aria-label="Previous track"
              className="p-2 rounded-md text-zinc-300 hover:text-white disabled:opacity-30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1]"
            >
              <SkipBack size={18} className="fill-current" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.92 }}
              transition={{ duration: 0.14 }}
              type="button"
              onClick={onTogglePlay}
              disabled={!track}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="w-10 h-10 rounded-full bg-[#4169E1] hover:bg-[#5478E8] text-white flex items-center justify-center transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8EFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#101318]"
            >
              {isPlaying ? (
                <Pause size={18} className="fill-current" />
              ) : (
                <Play size={18} className="fill-current ml-0.5" />
              )}
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.88 }}
              type="button"
              onClick={onNext}
              disabled={!track}
              aria-label="Next track"
              className="p-2 rounded-md text-zinc-300 hover:text-white disabled:opacity-30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1]"
            >
              <SkipForward size={18} className="fill-current" />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.88 }}
              type="button"
              onClick={onCycleRepeat}
              aria-label={`Repeat mode: ${repeat}`}
              className={`p-2 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] ${
                repeat !== 'off' ? 'text-[#6B8EFF]' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {repeat === 'one' ? <Repeat1 size={15} /> : <Repeat size={15} />}
            </motion.button>
          </div>

          {/* Scrubbable Progress Bar */}
          <div className="w-full flex items-center gap-2.5">
            <span className="font-mono-tabular text-[11px] text-zinc-400 w-9 text-right shrink-0">
              {formatDuration(currentTime)}
            </span>
            <div className="relative flex-1 h-4 flex items-center group">
              <div className="w-full h-1 rounded-full bg-white/15 overflow-hidden">
                <div
                  className="h-full bg-[#4169E1] group-hover:bg-[#5478E8] transition-[background-color]"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={safeDuration || 1}
                step={0.5}
                value={Math.min(currentTime, safeDuration)}
                disabled={!track}
                onChange={(e) => onSeek(Number(e.target.value))}
                aria-label="Seek playback position"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-default"
              />
            </div>
            <span className="font-mono-tabular text-[11px] text-zinc-500 w-9 shrink-0">
              {formatDuration(safeDuration)}
            </span>
          </div>
        </div>

        {/* Right: Queue + Volume */}
        <div className="flex items-center justify-end gap-3 shrink-0">
          <motion.button
            whileTap={{ scale: 0.94 }}
            type="button"
            onClick={onToggleQueue}
            aria-label="Toggle Up Next Queue"
            aria-expanded={isQueueOpen}
            className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1] ${
              isQueueOpen
                ? 'bg-white/10 text-[#6B8EFF]'
                : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
            }`}
          >
            <ListOrdered size={16} />
            <span className="font-mono-tabular">{queueLength}</span>
          </motion.button>

          <div className="flex items-center gap-2 w-28">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted || volume === 0 ? 'Unmute audio' : 'Mute audio'}
              className="p-1.5 rounded-md text-zinc-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1]"
            >
              {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <div className="relative flex-1 h-4 flex items-center">
              <div className="w-full h-1 rounded-full bg-white/15 overflow-hidden">
                <div
                  className="h-full bg-zinc-200"
                  style={{ width: `${(muted ? 0 : volume) * 100}%` }}
                />
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={muted ? 0 : volume}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
                aria-label="Volume"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
