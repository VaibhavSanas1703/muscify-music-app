import { PlayerPrefs, Playlist, RecentPlayEntry, Track } from '../types/music';

const KEYS = {
  LIKED_IDS: 'bitchord_liked_ids',
  RECENT_PLAYS: 'bitchord_recent_plays',
  PLAYLISTS: 'bitchord_playlists',
  PLAYER_PREFS: 'bitchord_player_prefs',
  ONLINE_TRACKS_CACHE: 'bitchord_youtube_tracks_cache',
} as const;

const DEFAULT_PREFS: PlayerPrefs = {
  volume: 0.82,
  muted: false,
  shuffle: false,
  repeat: 'off',
  lastTrackId: null,
  lastPosition: 0,
};

function isOnlineTrackId(id: string): boolean {
  return typeof id === 'string' && id.startsWith('yt-');
}

function safeReadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWriteJSON<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota issues gracefully
  }
}

export function loadLikedIds(): string[] {
  const raw = safeReadJSON<string[]>(KEYS.LIKED_IDS, []);
  return raw.filter(isOnlineTrackId);
}

export function saveLikedIds(ids: string[]): void {
  safeWriteJSON(KEYS.LIKED_IDS, ids.filter(isOnlineTrackId));
}

export function loadRecentPlays(): RecentPlayEntry[] {
  const raw = safeReadJSON<RecentPlayEntry[]>(KEYS.RECENT_PLAYS, []);
  return raw.filter((entry) => entry && isOnlineTrackId(entry.trackId));
}

export function saveRecentPlays(entries: RecentPlayEntry[]): void {
  safeWriteJSON(
    KEYS.RECENT_PLAYS,
    entries.filter((entry) => entry && isOnlineTrackId(entry.trackId))
  );
}

export function loadPlaylists(): Playlist[] {
  const existing = safeReadJSON<Playlist[] | null>(KEYS.PLAYLISTS, null);
  if (!existing) {
    safeWriteJSON(KEYS.PLAYLISTS, []);
    return [];
  }
  return existing.map((pl) => ({
    ...pl,
    trackIds: (pl.trackIds || []).filter(isOnlineTrackId),
  }));
}

export function savePlaylists(playlists: Playlist[]): void {
  safeWriteJSON(KEYS.PLAYLISTS, playlists);
}

export function loadPlayerPrefs(): PlayerPrefs {
  const loaded = {
    ...DEFAULT_PREFS,
    ...safeReadJSON<Partial<PlayerPrefs>>(KEYS.PLAYER_PREFS, {}),
  };
  if (loaded.lastTrackId && !isOnlineTrackId(loaded.lastTrackId)) {
    loaded.lastTrackId = null;
    loaded.lastPosition = 0;
  }
  return loaded;
}

export function savePlayerPrefs(prefs: PlayerPrefs): void {
  safeWriteJSON(KEYS.PLAYER_PREFS, prefs);
}

export function loadOnlineTracksCache(): Track[] {
  const raw = safeReadJSON<Track[]>(KEYS.ONLINE_TRACKS_CACHE, []);
  return raw.filter((tr) => tr && isOnlineTrackId(tr.id) && Boolean(tr.youtubeId));
}

export function saveOnlineTracksCache(tracks: Track[]): void {
  safeWriteJSON(
    KEYS.ONLINE_TRACKS_CACHE,
    tracks.filter((tr) => tr && isOnlineTrackId(tr.id) && Boolean(tr.youtubeId)).slice(0, 100)
  );
}
