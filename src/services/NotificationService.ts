/**
 * NotificationService
 * 
 * Handles audio notifications using the Web Audio API.
 */
export class NotificationService {
  private audioCtx: AudioContext | null = null;

  private initAudio() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  /**
   * Play a simple beep sound
   * @param frequency Frequency in Hz
   * @param duration Duration in seconds
   * @param type Oscillator type
   */
  private async playBeep(frequency: number, duration: number, volume: number = 0.1, type: OscillatorType = 'sine') {
    try {
      this.initAudio();
      if (!this.audioCtx) return;

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      const oscillator = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, this.audioCtx.currentTime);

      gainNode.gain.setValueAtTime(volume, this.audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);

      oscillator.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);

      oscillator.start();
      oscillator.stop(this.audioCtx.currentTime + duration);
    } catch (err) {
      console.warn('[NotificationService] Failed to play sound:', err);
    }
  }

  /**
   * Notify for agent attention needed (Action Required)
   */
  public async notifyAttention() {
    // Two short beeps
    await this.playBeep(440, 0.2, 0.1, 'triangle');
    setTimeout(() => this.playBeep(440, 0.2, 0.1, 'triangle'), 250);
  }

  /**
   * Notify for task completion
   */
  public async notifyComplete() {
    // Rising tone
    await this.playBeep(554.37, 0.1, 0.05); // C#5
    setTimeout(() => this.playBeep(659.25, 0.3, 0.05), 100); // E5
  }
}

export const notificationService = new NotificationService();
