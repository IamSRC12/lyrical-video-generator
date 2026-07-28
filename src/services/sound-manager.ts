
class SoundManager {
  private context: AudioContext | null = null;

  async beep(frequency = 660): Promise<void> {
    if (typeof window === "undefined") return;

    this.context ??= new AudioContext();

    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      frequency * 1.08,
      now + 0.08
    );

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);

    oscillator.connect(gain);
    gain.connect(this.context.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.14);
  }
}

export const soundManager = new SoundManager();


