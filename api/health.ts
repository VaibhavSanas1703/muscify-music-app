export default function handler(_req: any, res: any) {
  return res.status(200).json({
    ok: true,
    youtubeConfigured: Boolean(process.env.YOUTUBE_API_KEY?.trim()),
  });
}
