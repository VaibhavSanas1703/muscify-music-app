const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

interface YTPlayerInstance {
  loadVideoById: (options: { videoId: string; startSeconds?: number }) => void;
  cueVideoById: (options: { videoId: string; startSeconds?: number }) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unMute: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  destroy: () => void;
}

interface YTNamespace {
  Player: new (
    elementId: string | HTMLElement,
    options: {
      width?: string | number;
      height?: string | number;
      videoId?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: () => void;
        onStateChange?: (event: { data: number }) => void;
        onError?: (event: { data: number }) => void;
      };
    }
  ) => YTPlayerInstance;
  PlayerState: {
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
  };
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiLoadPromise: Promise<YTNamespace> | null = null;

function loadYouTubeIframeAPI(): Promise<YTNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window unavailable'));
  }
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }
  if (apiLoadPromise) {
    return apiLoadPromise;
  }

  apiLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]'
    );
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevCallback) prevCallback();
      if (window.YT?.Player) {
        resolve(window.YT);
      } else {
        reject(new Error('YouTube IFrame API failed to initialize'));
      }
    };

    if (!existing) {
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      script.async = true;
      script.onerror = () => reject(new Error('Failed to load YouTube IFrame API'));
      document.head.appendChild(script);
    }
  });

  return apiLoadPromise;
}

export interface YouTubePlayerCallbacks {
  onTimeUpdate: (time: number, duration: number) => void;
  onStateChange: (playing: boolean) => void;
  onEnded: () => void;
  onError: (message: string) => void;
}

export class YouTubePlayerBridge {
  private player: YTPlayerInstance | null = null;
  private ready = false;
  private pendingAction: (() => void) | null = null;
  private progressTimer: number | null = null;
  private containerId: string;
  private callbacks: YouTubePlayerCallbacks;
  private volume = 82;
  private muted = false;
  private active = false;

  constructor(containerId: string, callbacks: YouTubePlayerCallbacks) {
    this.containerId = containerId;
    this.callbacks = callbacks;
  }

  private async ensurePlayer(initialVideoId: string): Promise<void> {
    if (this.player && this.ready) return;
    if (this.player && !this.ready) return;

    const YT = await loadYouTubeIframeAPI();
    const host = document.getElementById(this.containerId);
    if (!host) {
      throw new Error('YouTube player container not found');
    }

    await new Promise<void>((resolve) => {
      this.player = new YT.Player(this.containerId, {
        width: '100%',
        height: '100%',
        videoId: initialVideoId,
        playerVars: {
          autoplay: 1,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
        },
        events: {
          onReady: () => {
            this.ready = true;
            this.applyAudioSettings();
            if (this.pendingAction) {
              const fn = this.pendingAction;
              this.pendingAction = null;
              fn();
            }
            resolve();
          },
          onStateChange: (event) => {
            if (!this.active) return;
            const state = event.data;
            if (state === YT.PlayerState.PLAYING) {
              this.callbacks.onStateChange(true);
              this.startProgressTimer();
            } else if (state === YT.PlayerState.PAUSED) {
              this.callbacks.onStateChange(false);
              this.stopProgressTimer();
            } else if (state === YT.PlayerState.ENDED) {
              this.callbacks.onStateChange(false);
              this.stopProgressTimer();
              this.callbacks.onEnded();
            }
          },
          onError: (event) => {
            if (!this.active) return;
            this.stopProgressTimer();
            this.callbacks.onStateChange(false);
            const msg =
              event.data === 101 || event.data === 150
                ? 'Playback for this track is restricted by the source.'
                : 'Could not stream this track. Try another result.';
            this.callbacks.onError(msg);
          },
        },
      });
    });
  }

  private applyAudioSettings(): void {
    if (!this.player || !this.ready) return;
    this.player.setVolume(this.volume);
    if (this.muted) this.player.mute();
    else this.player.unMute();
  }

  private startProgressTimer(): void {
    this.stopProgressTimer();
    this.progressTimer = window.setInterval(() => {
      if (!this.player || !this.ready || !this.active) return;
      const cur = this.player.getCurrentTime();
      const dur = this.player.getDuration();
      if (Number.isFinite(cur)) {
        this.callbacks.onTimeUpdate(cur, Number.isFinite(dur) && dur > 0 ? dur : 0);
      }
    }, 250);
  }

  private stopProgressTimer(): void {
    if (this.progressTimer !== null) {
      window.clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  public async loadAndPlay(videoId: string, startSeconds = 0): Promise<void> {
    if (!YOUTUBE_ID_RE.test(videoId)) {
      this.callbacks.onError('Invalid track ID.');
      return;
    }
    this.active = true;

    if (!this.player) {
      this.pendingAction = () => {
        this.player?.loadVideoById({ videoId, startSeconds });
      };
      await this.ensurePlayer(videoId);
      return;
    }

    if (!this.ready) {
      this.pendingAction = () => {
        this.player?.loadVideoById({ videoId, startSeconds });
      };
      return;
    }

    this.applyAudioSettings();
    this.player.loadVideoById({ videoId, startSeconds });
  }

  public pause(): void {
    this.stopProgressTimer();
    if (this.player && this.ready) {
      this.player.pauseVideo();
    }
  }

  public resume(): void {
    this.active = true;
    if (this.player && this.ready) {
      this.applyAudioSettings();
      this.player.playVideo();
    }
  }

  public stop(): void {
    this.active = false;
    this.stopProgressTimer();
    if (this.player && this.ready) {
      this.player.pauseVideo();
    }
  }

  public seek(seconds: number): void {
    if (this.player && this.ready) {
      this.player.seekTo(Math.max(0, seconds), true);
    }
  }

  public setVolume(value: number): void {
    this.volume = Math.round(Math.max(0, Math.min(1, value)) * 100);
    if (this.player && this.ready) {
      this.player.setVolume(this.volume);
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.player && this.ready) {
      if (muted) this.player.mute();
      else this.player.unMute();
    }
  }

  public destroy(): void {
    this.active = false;
    this.stopProgressTimer();
    if (this.player) {
      try {
        this.player.destroy();
      } catch {
        // Ignore teardown errors
      }
      this.player = null;
      this.ready = false;
    }
  }
}
