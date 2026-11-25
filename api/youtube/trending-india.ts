const YOUTUBE_VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
let cache: { tracks: any[]; fetchedAt: number } | null = null;

function parseIsoDuration(iso?: string): number {
  if (!iso) return 180;
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 180;
  const total = Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
  return total > 0 ? total : 180;
}

function decodeHtml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export default async function handler(req: any, res: any) {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) {
    return res.status(503).json({
      error: 'YOUTUBE_API_KEY_MISSING',
      message: 'Configure YOUTUBE_API_KEY in Vercel Environment Variables.',
    });
  }

  const forceRefresh = req.query?.refresh === '1';
  if (!forceRefresh && cache && Date.now() - cache.fetchedAt < 15 * 60 * 1000) {
    return res.status(200).json({ tracks: cache.tracks });
  }

  const ytSearch = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true',
    videoCategoryId: '10',
    maxResults: '18',
    q: 'latest bollywood hindi songs',
    regionCode: 'IN',
    relevanceLanguage: 'hi',
    key: apiKey,
  });

  const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?${ytSearch}`);
  if (!searchRes.ok) {
    const err = await searchRes.json().catch(() => ({}));
    return res.status(searchRes.status === 403 ? 403 : 502).json({
      error: 'YOUTUBE_UPSTREAM_ERROR',
      message: err?.error?.message || 'YouTube API request failed.',
    });
  }

  const searchData = await searchRes.json();
  const ids: string[] = (searchData.items || [])
    .map((i: any) => i?.id?.videoId)
    .filter((id: unknown): id is string => typeof id === 'string' && YOUTUBE_VIDEO_ID_RE.test(id));

  if (ids.length === 0) return res.status(200).json({ tracks: [] });

  const ytVideos = new URLSearchParams({ part: 'snippet,contentDetails', id: ids.join(','), key: apiKey });
  const detailsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?${ytVideos}`);
  if (!detailsRes.ok) {
    return res.status(502).json({ error: 'YOUTUBE_DETAILS_ERROR', message: 'Failed to load track details.' });
  }

  const detailsData = await detailsRes.json();
  const rawTracks = (detailsData.items || [])
    .filter((i: any) => typeof i?.id === 'string' && YOUTUBE_VIDEO_ID_RE.test(i.id))
    .map((item: any) => ({
      id: `yt-${item.id}`,
      youtubeId: item.id,
      title: decodeHtml(item.snippet?.title || 'Untitled Track'),
      artist: decodeHtml(item.snippet?.channelTitle || 'Online Artist').replace(/\s*-\s*Topic$/i, ''),
      albumId: 'online-stream',
      album: 'Online Stream',
      genre: 'Online',
      duration: parseIsoDuration(item.contentDetails?.duration),
      bpm: 0,
      musicalKey: 'Stream',
      coverUrl:
        item.snippet?.thumbnails?.high?.url ||
        item.snippet?.thumbnails?.medium?.url ||
        item.snippet?.thumbnails?.default?.url ||
        '',
      year: item.snippet?.publishedAt ? new Date(item.snippet.publishedAt).getFullYear() : new Date().getFullYear(),
      source: 'youtube',
    }));

  const songLength = rawTracks.filter((t: any) => t.duration >= 60 && t.duration <= 720);
  const tracks = (songLength.length >= 5 ? songLength : rawTracks).slice(0, 10);
  cache = { tracks, fetchedAt: Date.now() };

  return res.status(200).json({ tracks });
}
