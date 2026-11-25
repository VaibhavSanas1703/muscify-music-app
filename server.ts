import dotenv from 'dotenv';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const YOUTUBE_VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
const TRENDING_CACHE_TTL_MS = 15 * 60 * 1000;

interface YouTubeSearchItem {
  id?: { videoId?: string };
}

interface YouTubeVideoItem {
  id?: string;
  snippet?: {
    title?: string;
    channelTitle?: string;
    publishedAt?: string;
    thumbnails?: {
      high?: { url?: string };
      medium?: { url?: string };
      default?: { url?: string };
    };
  };
  contentDetails?: {
    duration?: string;
  };
}

interface OnlineTrack {
  id: string;
  youtubeId: string;
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
  source: 'youtube';
}

let trendingIndiaCache: { tracks: OnlineTrack[]; fetchedAt: number } | null = null;

function parseIsoDuration(iso?: string): number {
  if (!iso || typeof iso !== 'string') return 180;
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 180;
  const hours = Number(match[1] || 0);
  const mins = Number(match[2] || 0);
  const secs = Number(match[3] || 0);
  const total = hours * 3600 + mins * 60 + secs;
  return total > 0 ? total : 180;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function sanitizeThumbnailUrl(url?: string): string {
  if (!url || typeof url !== 'string') return '';
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol === 'https:' &&
      (parsed.hostname.endsWith('ytimg.com') || parsed.hostname.endsWith('ggpht.com'))
    ) {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

async function fetchOnlineTracks(
  apiKey: string,
  query: string,
  maxResults: number,
  extraParams?: Record<string, string>
): Promise<{ status: number; tracks?: OnlineTrack[]; error?: string; message?: string }> {
  const searchParams = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    videoEmbeddable: 'true',
    videoCategoryId: '10',
    maxResults: String(maxResults),
    q: query,
    key: apiKey,
    ...extraParams,
  });

  const searchResp = await fetch(
    `https://www.googleapis.com/youtube/v3/search?${searchParams.toString()}`
  );

  if (!searchResp.ok) {
    const errBody = (await searchResp.json().catch(() => ({}))) as {
      error?: { message?: string; code?: number };
    };
    const status = searchResp.status === 403 ? 403 : 502;
    return {
      status,
      error: 'YOUTUBE_UPSTREAM_ERROR',
      message:
        errBody.error?.message ||
        'Online catalog request failed. Verify your API key quota and permissions.',
    };
  }

  const searchData = (await searchResp.json()) as { items?: YouTubeSearchItem[] };
  const videoIds = (searchData.items || [])
    .map((item) => item.id?.videoId)
    .filter((id): id is string => Boolean(id && YOUTUBE_VIDEO_ID_RE.test(id)));

  if (videoIds.length === 0) {
    return { status: 200, tracks: [] };
  }

  const detailsParams = new URLSearchParams({
    part: 'snippet,contentDetails',
    id: videoIds.join(','),
    key: apiKey,
  });

  const detailsResp = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?${detailsParams.toString()}`
  );

  if (!detailsResp.ok) {
    return {
      status: 502,
      error: 'YOUTUBE_DETAILS_ERROR',
      message: 'Failed to load track durations from the online catalog.',
    };
  }

  const detailsData = (await detailsResp.json()) as { items?: YouTubeVideoItem[] };

  const tracks: OnlineTrack[] = (detailsData.items || [])
    .filter((item): item is YouTubeVideoItem & { id: string } =>
      Boolean(item.id && YOUTUBE_VIDEO_ID_RE.test(item.id))
    )
    .map((item) => {
      const rawTitle = decodeHtmlEntities(item.snippet?.title || 'Untitled Track');
      const channel = decodeHtmlEntities(item.snippet?.channelTitle || 'Online Artist').replace(
        /\s*-\s*Topic$/i,
        ''
      );
      const thumb =
        sanitizeThumbnailUrl(item.snippet?.thumbnails?.high?.url) ||
        sanitizeThumbnailUrl(item.snippet?.thumbnails?.medium?.url) ||
        sanitizeThumbnailUrl(item.snippet?.thumbnails?.default?.url);
      const year = item.snippet?.publishedAt
        ? new Date(item.snippet.publishedAt).getFullYear()
        : new Date().getFullYear();

      return {
        id: `yt-${item.id}`,
        youtubeId: item.id,
        title: rawTitle,
        artist: channel,
        albumId: 'online-stream',
        album: 'Online Stream',
        genre: 'Online',
        duration: parseIsoDuration(item.contentDetails?.duration),
        bpm: 0,
        musicalKey: 'Stream',
        coverUrl: thumb,
        year: Number.isFinite(year) ? year : new Date().getFullYear(),
        source: 'youtube',
      };
    });

  return { status: 200, tracks };
}

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      youtubeConfigured: Boolean(process.env.YOUTUBE_API_KEY?.trim()),
    });
  });

  app.get('/api/youtube/search', async (req: Request, res: Response) => {
    const apiKey = process.env.YOUTUBE_API_KEY?.trim();
    if (!apiKey) {
      res.status(503).json({
        error: 'YOUTUBE_API_KEY_MISSING',
        message: 'Online search requires YOUTUBE_API_KEY to be configured in Settings -> Secrets.',
      });
      return;
    }

    const rawQuery = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!rawQuery || rawQuery.length > 120) {
      res.status(400).json({
        error: 'INVALID_QUERY',
        message: 'Please provide a search query between 1 and 120 characters.',
      });
      return;
    }

    const parsedMax = Number(req.query.maxResults);
    const maxResults = Number.isFinite(parsedMax)
      ? Math.min(20, Math.max(1, Math.floor(parsedMax)))
      : 12;

    try {
      const result = await fetchOnlineTracks(apiKey, rawQuery, maxResults);
      if (result.status !== 200) {
        res.status(result.status).json({ error: result.error, message: result.message });
        return;
      }
      res.json({ tracks: result.tracks || [] });
    } catch {
      res.status(502).json({
        error: 'NETWORK_ERROR',
        message: 'Could not reach the online music catalog from the server.',
      });
    }
  });

  app.get('/api/youtube/trending-india', async (req: Request, res: Response) => {
    const apiKey = process.env.YOUTUBE_API_KEY?.trim();
    if (!apiKey) {
      res.status(503).json({
        error: 'YOUTUBE_API_KEY_MISSING',
        message: 'Online catalog requires YOUTUBE_API_KEY to be configured in Settings -> Secrets.',
      });
      return;
    }

    const forceRefresh = req.query.refresh === '1';
    if (
      !forceRefresh &&
      trendingIndiaCache &&
      Date.now() - trendingIndiaCache.fetchedAt < TRENDING_CACHE_TTL_MS
    ) {
      res.json({ tracks: trendingIndiaCache.tracks });
      return;
    }

    try {
      const result = await fetchOnlineTracks(apiKey, 'latest bollywood hindi songs', 18, {
        regionCode: 'IN',
        relevanceLanguage: 'hi',
      });

      if (result.status !== 200) {
        res.status(result.status).json({ error: result.error, message: result.message });
        return;
      }

      const rawTracks = result.tracks || [];
      // Prefer standalone songs (1–12 min) over shorts or hour-long jukeboxes
      const songLengthTracks = rawTracks.filter((t) => t.duration >= 60 && t.duration <= 720);
      const finalTracks = (songLengthTracks.length >= 5 ? songLengthTracks : rawTracks).slice(
        0,
        10
      );

      trendingIndiaCache = { tracks: finalTracks, fetchedAt: Date.now() };
      res.json({ tracks: finalTracks });
    } catch {
      res.status(502).json({
        error: 'NETWORK_ERROR',
        message: 'Could not reach the online music catalog from the server.',
      });
    }
  });

  app.get('/muscify-source.zip', (_req: Request, res: Response) => {
    const zipPath = path.resolve(__dirname, 'public', 'muscify-source.zip');
    res.download(zipPath, 'muscify-source.zip');
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Muscify server running on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
