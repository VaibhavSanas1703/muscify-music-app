const YOUTUBE_VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

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

  const query = typeof req.query?.q === 'string' ? req.query.q.trim() : '';
  if (!query || query.length > 120) {
    return res.status(400).json({ error: 'INVALID_QUERY', message: 'Provide a query (1-120 chars).' });
  }

  const parsedMax = Number(req.query?.maxResults);
  const maxResults = Number.isFinite(parsedMax) ? Math.min(20, Math.max(1, Math.floor(parsedMax))) : 12;

  const ytSearch = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true',
    videoCategoryId: '10',
    maxResults: String(maxResults),
    q: query,
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
  const tracks = (detailsData.items || [])
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

  return res.status(200).json({ tracks });
}
