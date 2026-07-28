class SoundManager {
  private audio: HTMLAudioElement | null = null;
  private onTimeUpdateCallback: ((time: number) => void) | null = null;
  private onEndedCallback: (() => void) | null = null;

  init(url: string) {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = "";
    }

    this.audio = new Audio(url);
    this.audio.preload = "auto";

    this.audio.addEventListener("timeupdate", () => {
      if (this.audio && this.onTimeUpdateCallback) {
        this.onTimeUpdateCallback(this.audio.currentTime);
      }
    });

    this.audio.addEventListener("ended", () => {
      if (this.onEndedCallback) {
        this.onEndedCallback();
      }
    });
  }

  play() {
    if (this.audio && this.audio.paused) {
      this.audio.play().catch(() => {});
    }
  }

  pause() {
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
    }
  }

  seek(time: number) {
    if (this.audio && Number.isFinite(time)) {
      // Avoid tiny redundant seek jitter
      if (Math.abs(this.audio.currentTime - time) > 0.05) {
        this.audio.currentTime = time;
      }
    }
  }

  onTimeUpdate(callback: (time: number) => void) {
    this.onTimeUpdateCallback = callback;
  }

  onEnded(callback: () => void) {
    this.onEndedCallback = callback;
  }

  destroy() {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = "";
      this.audio = null;
    }
    this.onTimeUpdateCallback = null;
    this.onEndedCallback = null;
  }
}

export const soundManager = new SoundManager();
