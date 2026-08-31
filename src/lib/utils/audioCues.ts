/**
 * PayBack AI — Sound Design & Web Audio API Cues for Live Recovery Runner.
 *
 * Provides short, subtle synthesizer tone cues (<300ms) without external audio files:
 * - Payment Recovered: Uplifting major third chime (523Hz -> 659Hz)
 * - Payment Stopped (Safety Rule): Soft low warning ping (330Hz -> 220Hz)
 * - Escalated to Human Review: Neutral gentle pulse (440Hz)
 */

let globalAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass =
    window.AudioContext ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).webkitAudioContext;

  if (!AudioContextClass) return null;

  if (!globalAudioCtx) {
    try {
      globalAudioCtx = new AudioContextClass();
    } catch {
      return null;
    }
  }

  if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
    globalAudioCtx.resume().catch(() => {});
  }

  return globalAudioCtx;
}

/**
 * Play an uplifting recovery chime.
 */
export function playRecoveredTone(isMuted = true): void {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Frequency glide from C5 (523Hz) to E5 (659Hz)
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.09);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.18);
  } catch {
    // Ignore audio playback errors on restricted browsers
  }
}

/**
 * Play a subtle low safety-stop ping.
 */
export function playSafetyStopTone(isMuted = true): void {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    // Frequency drop from E4 (329.6Hz) to A3 (220Hz)
    osc.frequency.setValueAtTime(329.63, now);
    osc.frequency.exponentialRampToValueAtTime(220.0, now + 0.14);

    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.15);
  } catch {
    // Ignore audio playback errors
  }
}

/**
 * Play a neutral human review pulse.
 */
export function playHumanReviewTone(isMuted = true): void {
  if (isMuted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440.0, now);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.12);
  } catch {
    // Ignore audio playback errors
  }
}
