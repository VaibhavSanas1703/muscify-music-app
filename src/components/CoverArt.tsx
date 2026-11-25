import { Disc3 } from 'lucide-react';
import { useState } from 'react';

interface CoverArtProps {
  src?: string;
  alt: string;
  className?: string;
  iconSize?: number;
}

export function CoverArt({
  src,
  alt,
  className = 'w-12 h-12 rounded-md',
  iconSize = 20,
}: CoverArtProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-[#1C212B] via-[#13171F] to-[#0D1015] border border-white/10 text-zinc-400 shrink-0 ${className}`}
        aria-label={alt}
      >
        <Disc3 size={iconSize} className="text-[#6B8EFF]/80" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`object-cover bg-[#141820] shrink-0 ${className}`}
    />
  );
}
