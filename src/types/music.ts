export type TrackSource = 'youtube';

export interface Track {
  id: string;
  title: string;
  artist: string;
  albumId: string;
  album: string;
  genre: 'Online';
  duration: number;
  bpm: number;
  musicalKey: string;
  coverUrl: string;
  year: number;
  source: TrackSource;
  youtubeId: string;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  trackIds: string[];
  createdAt: number;
}

export interface RecentPlayEntry {
  trackId: string;
  playedAt: number;
  playCount: number;
}

export type RepeatMode = 'off' | 'all' | 'one';

export interface PlayerPrefs {
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  lastTrackId: string | null;
  lastPosition: number;
}

export type LibraryView = 'discover' | 'search' | 'liked' | 'recent' | 'playlist';
