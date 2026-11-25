import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { FormEvent, useEffect, useState } from 'react';

interface PlaylistModalProps {
  isOpen: boolean;
  mode: 'create' | 'rename';
  initialName?: string;
  initialDescription?: string;
  onClose: () => void;
  onSubmit: (name: string, description: string) => void;
}

export function PlaylistModal({
  isOpen,
  mode,
  initialName = '',
  initialDescription = '',
  onClose,
  onSubmit,
}: PlaylistModalProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setDescription(initialDescription);
    }
  }, [isOpen, initialName, initialDescription]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed, description.trim());
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="playlist-modal-title"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-xl bg-[#12151A] border border-white/10 p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 id="playlist-modal-title" className="text-lg font-semibold text-white">
                {mode === 'create' ? 'New Playlist' : 'Edit Playlist'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4169E1]"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="playlist-name"
                  className="block text-xs font-medium text-zinc-400 mb-1.5"
                >
                  Playlist Name
                </label>
                <input
                  id="playlist-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Sunday Vinyl"
                  autoFocus
                  maxLength={48}
                  className="w-full rounded-lg bg-[#0B0D10] border border-white/10 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#4169E1] transition-colors"
                />
              </div>

              <div>
                <label
                  htmlFor="playlist-desc"
                  className="block text-xs font-medium text-zinc-400 mb-1.5"
                >
                  Notes (optional)
                </label>
                <textarea
                  id="playlist-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Mood, tempo, or session notes"
                  rows={2}
                  maxLength={140}
                  className="w-full rounded-lg bg-[#0B0D10] border border-white/10 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#4169E1] transition-colors resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap shrink-0"
                >
                  Cancel
                </button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  type="submit"
                  disabled={!name.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-semibold bg-[#4169E1] text-white hover:bg-[#5478E8] disabled:opacity-40 disabled:pointer-events-none transition-colors whitespace-nowrap shrink-0"
                >
                  {mode === 'create' ? 'Create Playlist' : 'Save Changes'}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
