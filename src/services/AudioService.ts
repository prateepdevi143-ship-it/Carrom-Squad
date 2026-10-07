/**
 * High-fidelity Procedural Web Audio Engine for Carrom Clash
 * Features impulse-scaled dynamics, physical wood resonance synthesis,
 * spatial stereo panning, multi-sound variations, and haptic feedback.
 */

class AudioService {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private masterVolume: number = 0.85;
  private effectsVolume: number = 0.9;
  private uiVolume: number = 0.7;

  constructor() {
    const stored = localStorage.getItem('carrom_settings_audio');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (typeof parsed.soundEnabled === 'boolean') this.soundEnabled = parsed.soundEnabled;
        if (typeof parsed.masterVolume === 'number') this.masterVolume = parsed.masterVolume;
        else if (typeof parsed.volume === 'number') this.masterVolume = parsed.volume;
        if (typeof parsed.effectsVolume === 'number') this.effectsVolume = parsed.effectsVolume;
      } catch (e) {}
    }
  }

  private initCtx(): AudioContext | null {
    if (!this.soundEnabled) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Creates an output node chain with optional stereo panner (board X: 0 to 800)
  private createPanner(ctx: AudioContext, posX?: number): AudioNode {
    if (posX !== undefined && ctx.createStereoPanner) {
      const panner = ctx.createStereoPanner();
      // Map board X [0, 800] to pan [-0.85, 0.85]
      const panVal = Math.max(-0.85, Math.min(0.85, ((posX - 400) / 400) * 0.85));
      panner.pan.setValueAtTime(panVal, ctx.currentTime);
      panner.connect(ctx.destination);
      return panner;
    }
    return ctx.destination;
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    this.saveSettings();
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  public setVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    this.saveSettings();
  }

  public getVolume(): number {
    return this.masterVolume;
  }

  public setEffectsVolume(vol: number) {
    this.effectsVolume = Math.max(0, Math.min(1, vol));
    this.saveSettings();
  }

  public getEffectsVolume(): number {
    return this.effectsVolume;
  }

  private saveSettings() {
    localStorage.setItem('carrom_settings_audio', JSON.stringify({
      soundEnabled: this.soundEnabled,
      masterVolume: this.masterVolume,
      effectsVolume: this.effectsVolume,
    }));
  }

  // Haptic feedback trigger for mobile devices (safe, optional)
  public triggerHaptic(type: 'light' | 'medium' | 'heavy' = 'light') {
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      try {
        if (type === 'light') navigator.vibrate(10);
        else if (type === 'medium') navigator.vibrate(22);
        else if (type === 'heavy') navigator.vibrate(40);
      } catch (e) {}
    }
  }

  // 1. Striker shot release - sharp wood/ivory impulse
  public playStrikerHit(powerNorm: number = 0.7, posX: number = 400) {
    const ctx = this.initCtx();
    if (!ctx) return;

    const t = ctx.currentTime;
    const dest = this.createPanner(ctx, posX);
    const vol = this.masterVolume * this.effectsVolume * Math.min(1, Math.max(0.2, powerNorm));

    // Transient click
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(240, t);
    clickOsc.frequency.exponentialRampToValueAtTime(45, t + 0.07);

    clickGain.gain.setValueAtTime(vol * 0.9, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.075);

    clickOsc.connect(clickGain);
    clickGain.connect(dest);
    clickOsc.start(t);
    clickOsc.stop(t + 0.08);

    // Resonant wooden body
    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    bodyOsc.type = 'sine';
    bodyOsc.frequency.setValueAtTime(110, t);
    bodyOsc.frequency.exponentialRampToValueAtTime(40, t + 0.1);

    bodyGain.gain.setValueAtTime(vol * 0.6, t);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    bodyOsc.connect(bodyGain);
    bodyGain.connect(dest);
    bodyOsc.start(t);
    bodyOsc.stop(t + 0.11);

    this.triggerHaptic(powerNorm > 0.75 ? 'heavy' : 'medium');
  }

  // 2. Coin collision - crisp wooden clack with impulse scaling & variations
  public playCoinClack(impulseStrength: number = 5, posX?: number) {
    const ctx = this.initCtx();
    if (!ctx) return;

    const t = ctx.currentTime;
    const dest = this.createPanner(ctx, posX);

    // Map impulse to volume (0.12 to 1.0)
    const normalizedStrength = Math.min(1.0, Math.max(0.1, impulseStrength / 12));
    const vol = this.masterVolume * this.effectsVolume * normalizedStrength * 0.75;

    // 4 subtle pitch variations
    const variation = Math.floor(Math.random() * 4);
    const baseFreqs = [1850, 1620, 2100, 1950];
    const baseFreq = baseFreqs[variation] + (Math.random() - 0.5) * 120;

    // High snap
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.028);

    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.028);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.03);

    // Subtle wooden knock undertone on medium/heavy impacts
    if (normalizedStrength > 0.35) {
      const underOsc = ctx.createOscillator();
      const underGain = ctx.createGain();
      underOsc.type = 'triangle';
      underOsc.frequency.setValueAtTime(380 + variation * 25, t);
      underOsc.frequency.exponentialRampToValueAtTime(120, t + 0.035);

      underGain.gain.setValueAtTime(vol * 0.45, t);
      underGain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

      underOsc.connect(underGain);
      underGain.connect(dest);
      underOsc.start(t);
      underOsc.stop(t + 0.04);
    }
  }

  // 3. Wall cushion bounce - slightly softer, deeper bounce
  public playWallBounce(velocity: number = 4, posX?: number) {
    const ctx = this.initCtx();
    if (!ctx) return;

    const t = ctx.currentTime;
    const dest = this.createPanner(ctx, posX);
    const intensity = Math.min(1, Math.max(0.12, velocity / 12));
    const vol = this.masterVolume * this.effectsVolume * intensity * 0.55;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(160 + (Math.random() - 0.5) * 20, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.05);

    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.055);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(t);
    osc.stop(t + 0.06);
  }

  // 4. Pocket sink - deep muted hollow thud
  public playPocketSink(isQueen: boolean = false, posX?: number) {
    const ctx = this.initCtx();
    if (!ctx) return;

    const t = ctx.currentTime;
    const dest = this.createPanner(ctx, posX);
    const vol = this.masterVolume * this.effectsVolume * 0.8;

    // Deep hollow hole resonance
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(95, t + 0.16);

    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc.connect(gain);
    gain.connect(dest);

    osc.start(t);
    osc.stop(t + 0.19);

    this.triggerHaptic('medium');

    if (isQueen) {
      setTimeout(() => this.playQueenCelebration(), 120);
    }
  }

  // 5. Queen celebration - elegant harmonious bell
  public playQueenCelebration() {
    const ctx = this.initCtx();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const t = ctx.currentTime + idx * 0.07;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(this.masterVolume * this.effectsVolume * 0.45, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.23);
    });
    this.triggerHaptic('heavy');
  }

  // 6. Foul buzzer - short low notification
  public playFoul() {
    const ctx = this.initCtx();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(125, t);
    osc.frequency.setValueAtTime(105, t + 0.08);

    gain.gain.setValueAtTime(this.masterVolume * this.effectsVolume * 0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.23);
    this.triggerHaptic('heavy');
  }

  // 7. Turn change - subtle gentle ping
  public playTurnChange() {
    const ctx = this.initCtx();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(784, t); // G5
    gain.gain.setValueAtTime(this.masterVolume * this.uiVolume * 0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.13);
  }

  // 8. Power meter milestone tick (25%, 50%, 75%, 100%)
  public playPowerHapticTick(level: number) {
    this.triggerHaptic(level >= 100 ? 'medium' : 'light');
    const ctx = this.initCtx();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(450 + level * 4, t);
    gain.gain.setValueAtTime(this.masterVolume * this.uiVolume * 0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.03);
  }

  // 9. UI click
  public playClick() {
    const ctx = this.initCtx();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, t);
    gain.gain.setValueAtTime(this.masterVolume * this.uiVolume * 0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.035);
  }

  // 10. Match victory fanfare
  public playVictory() {
    const ctx = this.initCtx();
    if (!ctx) return;

    const chord = [392, 523.25, 659.25, 783.99, 1046.50];
    chord.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.1;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(this.masterVolume * this.effectsVolume * 0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.36);
    });
  }
}

export const audio = new AudioService();
