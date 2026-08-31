/**
 * Unit tests for PayBack AI Web Audio API tone cues.
 */

import { describe, it, expect } from 'vitest';
import {
  playRecoveredTone,
  playSafetyStopTone,
  playHumanReviewTone,
} from '../audioCues';

describe('Audio Cues Synthesizer (Web Audio API)', () => {

  it('safely no-ops when isMuted is true', () => {
    // Should not throw or instantiate AudioContext when muted
    expect(() => playRecoveredTone(true)).not.toThrow();
    expect(() => playSafetyStopTone(true)).not.toThrow();
    expect(() => playHumanReviewTone(true)).not.toThrow();
  });

  it('safely handles environments where window.AudioContext is undefined', () => {
    expect(() => playRecoveredTone(false)).not.toThrow();
    expect(() => playSafetyStopTone(false)).not.toThrow();
    expect(() => playHumanReviewTone(false)).not.toThrow();
  });
});
