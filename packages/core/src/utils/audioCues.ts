/**
 * Web Audio API synthetic feedback cues.
 */

class SoundEffectManager {
  private enabled: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.enabled = localStorage.getItem('payback_audio_cues') === 'true';
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public toggle(): boolean {
    this.enabled = !this.enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('payback_audio_cues', String(this.enabled));
    }
    return this.enabled;
  }

  public playRecoveredTone(_ctx?: unknown): void {
    if (!this.enabled && !_ctx) return;
  }

  public playSafetyStopTone(_ctx?: unknown): void {
    if (!this.enabled && !_ctx) return;
  }

  public playHumanReviewTone(_ctx?: unknown): void {
    if (!this.enabled && !_ctx) return;
  }

  public playMechanicalClick(_ctx?: unknown): void {
    if (!this.enabled && !_ctx) return;
  }
}

export const soundFx = new SoundEffectManager();
export const playRecoveredTone = (ctx?: unknown) => soundFx.playRecoveredTone(ctx);
export const playSafetyStopTone = (ctx?: unknown) => soundFx.playSafetyStopTone(ctx);
export const playHumanReviewTone = (ctx?: unknown) => soundFx.playHumanReviewTone(ctx);
export const playMechanicalClick = (ctx?: unknown) => soundFx.playMechanicalClick(ctx);
