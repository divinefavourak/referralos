// ReferralOS Browser-Native Web Audio API Synthesizer
// Provides realistic tactical alert chimes, pre-arrival sirens, and reroute alarms
// Zero external asset downloads, sub-millisecond audio latency.

let audioCtx: AudioContext | null = null;
let isAudioMuted = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function setAudioMuted(muted: boolean) {
  isAudioMuted = muted;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('referralos_audio_muted', muted ? 'true' : 'false');
    } catch {}
  }
}

export function getAudioMuted(): boolean {
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem('referralos_audio_muted') === 'true' || isAudioMuted;
    } catch {}
  }
  return isAudioMuted;
}

/**
 * Tactical two-tone emergency siren for rerouting and critical pre-arrivals
 */
export function playEmergencySiren(durationSeconds: number = 3.5) {
  if (getAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sawtooth';

  // Siren frequency oscillation between 650Hz and 950Hz
  const cycles = Math.floor(durationSeconds / 0.4);
  for (let i = 0; i < cycles; i++) {
    const t = now + i * 0.4;
    osc.frequency.setValueAtTime(650, t);
    osc.frequency.linearRampToValueAtTime(950, t + 0.2);
    osc.frequency.linearRampToValueAtTime(650, t + 0.4);
  }

  // Volume envelope with gentle attack & decay
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.12, now + 0.1);
  gain.gain.setValueAtTime(0.12, now + durationSeconds - 0.2);
  gain.gain.linearRampToValueAtTime(0.001, now + durationSeconds);

  // Lowpass filter to avoid harshness
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1800;

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + durationSeconds);
}

/**
 * Pre-arrival alert chime for ER triage desk (urgent ascending triple chime)
 */
export function playPreArrivalChime() {
  if (getAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = [587.33, 739.99, 880.0]; // D5, F#5, A5
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime + idx * 0.14;

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.5);
  });
}

/**
 * Handover completed / Atomic lock verified chime (warm harmonious double chime)
 */
export function playSuccessChime() {
  if (getAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime + idx * 0.1;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.14, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.65);
  });
}

/**
 * Warning alert for local walk-in preemption or hard constraint rejection
 */
export function playWarningBeep() {
  if (getAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  [0, 0.18].forEach((offset) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime + offset;

    osc.type = 'square';
    osc.frequency.setValueAtTime(440, t);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.08, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.14);
  });
}

/**
 * Synchronized cardiac heartbeat acoustic pulse (dual lub-dub)
 */
export function playHeartbeatPulse() {
  if (getAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // S1 'Lub' - low frequency thump (~62 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(62, now);
    osc1.frequency.exponentialRampToValueAtTime(45, now + 0.09);
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.linearRampToValueAtTime(0.18, now + 0.015);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.14);

    // S2 'Dub' - slightly higher frequency thump (~86 Hz), 110ms later
    const t2 = now + 0.11;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(86, t2);
    osc2.frequency.exponentialRampToValueAtTime(55, t2 + 0.11);
    gain2.gain.setValueAtTime(0.001, t2);
    gain2.gain.linearRampToValueAtTime(0.22, t2 + 0.015);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.15);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t2);
    osc2.stop(t2 + 0.16);
  } catch {}
}

/**
 * Ensures the Web Audio context is running and resumed
 */
export async function ensureAudioResumed(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;
  if ((ctx.state as string) === 'suspended') {
    try {
      await ctx.resume();
      return (ctx.state as string) === 'running';
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Urgent clinical intake vital signs alert (high-acuity double beep)
 */
export function playClinicalIntakeBeep() {
  if (getAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    [0, 0.15].forEach((offset) => {
      const t = now + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t);
      osc.frequency.exponentialRampToValueAtTime(1100, t + 0.08);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.12);
    });
  } catch {}
}

/**
 * Paramedic VHF radio dispatch chirp and carrier burst
 */
export function playRadioTelemetryChirp() {
  if (getAudioMuted()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1250, now);
    osc.frequency.linearRampToValueAtTime(1850, now + 0.04);
    osc.frequency.setValueAtTime(1400, now + 0.06);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1500;
    filter.Q.value = 2.0;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  } catch {}
}

let isVoiceEnabled = true;

export function getVoiceNarration(): boolean {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('referralos_voice_narration');
      if (stored !== null) return stored === 'true';
    } catch {}
  }
  return isVoiceEnabled;
}

export function setVoiceNarration(enabled: boolean) {
  isVoiceEnabled = enabled;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('referralos_voice_narration', enabled ? 'true' : 'false');
      if (!enabled && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch {}
  }
}

/**
 * Spoken clinical narration for the 43-minute emergency transfer story
 */
export function speakNarrative(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (getAudioMuted() || !getVoiceNarration()) return;

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 0.95;
    window.speechSynthesis.speak(utterance);
  } catch {}
}
