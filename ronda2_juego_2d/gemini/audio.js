/* ==========================================================================
   SINTONÍA: TEJEDOR DE FASE — Sintetizador Procedural Web Audio (Sin assets)
   ========================================================================== */

(function (global) {
  'use strict';

  // Escala Pentatónica / Dórica en Re (Hz) para que cada armonización suene musical
  const HARMONIC_SCALE = [
    293.66, // D4
    349.23, // F4
    392.00, // G4
    440.00, // A4
    523.25, // C5
    587.33, // D5
    698.46, // F5
    783.99, // G5
    880.00, // A5
    1046.50, // C6
    1174.66  // D6
  ];

  class SoundEngine {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.muted = false;
      this.initialized = false;
    }

    init() {
      if (this.initialized) {
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
        return;
      }
      try {
        const AudioCtx = global.AudioContext || global.webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 0.28;
        this.masterGain.connect(this.ctx.destination);
        this.initialized = true;
      } catch (e) {
        this.initialized = false;
      }
    }

    toggleMute() {
      this.muted = !this.muted;
      if (!this.initialized) this.init();
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.28, this.ctx.currentTime);
      }
      return this.muted;
    }

    _canPlay() {
      if (this.muted) return false;
      if (!this.initialized) this.init();
      if (!this.ctx || !this.masterGain) return false;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return true;
    }

    _tone(freq, type, duration, gainVal, delay = 0, freqEnd = null) {
      if (!this._canPlay()) return;
      const now = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (freqEnd !== null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
      }

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(gainVal, now + Math.min(0.015, duration * 0.2));
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + duration + 0.02);
    }

    playUIClick() {
      this._tone(660, 'sine', 0.07, 0.22, 0, 880);
    }

    playPhaseSwitch(phase) {
      if (!this._canPlay()) return;
      if (phase === 'cyan') {
        this._tone(440, 'triangle', 0.11, 0.25, 0, 659.25);
        this._tone(880, 'sine', 0.14, 0.16, 0.02, 1174.66);
      } else {
        this._tone(587.33, 'triangle', 0.11, 0.25, 0, 392.00);
        this._tone(293.66, 'sine', 0.14, 0.20, 0.02, 220.00);
      }
    }

    playWhipSnap() {
      if (!this._canPlay()) return;
      // Cuerda tensa + barrido de aire
      this._tone(190, 'sawtooth', 0.18, 0.26, 0, 740);
      this._tone(740, 'triangle', 0.22, 0.28, 0.03, 260);
    }

    playHarmonize(combo = 1, phase = 'cyan') {
      if (!this._canPlay()) return;
      const idx = Math.min(HARMONIC_SCALE.length - 1, Math.max(0, combo - 1));
      const baseFreq = HARMONIC_SCALE[idx];
      const waveType = phase === 'cyan' ? 'sine' : 'triangle';

      this._tone(baseFreq, waveType, 0.24, 0.34, 0, baseFreq * 1.005);
      // Sobretono armónico de quinta o octava
      this._tone(baseFreq * 1.5, 'sine', 0.18, 0.16, 0.025, baseFreq * 2.0);
    }

    playDeflect() {
      if (!this._canPlay()) return;
      this._tone(240, 'square', 0.08, 0.16, 0, 140);
    }

    playLoopCollapse(capturedCount = 1) {
      if (!this._canPlay()) return;
      const chord = [293.66, 349.23, 440.00, 523.25, 659.25, 880.00];
      const notesToPlay = Math.min(chord.length, 3 + capturedCount);
      for (let i = 0; i < notesToPlay; i++) {
        this._tone(chord[i], 'triangle', 0.42, 0.26, i * 0.04, chord[i] * 1.01);
        this._tone(chord[i] * 2, 'sine', 0.35, 0.12, i * 0.04 + 0.02);
      }
    }

    playTriadNode(step = 1) {
      if (!this._canPlay()) return;
      const notes = [440.0, 554.37, 659.25, 880.0];
      if (step < 3) {
        const f = notes[step - 1] || 440;
        this._tone(f, 'sine', 0.28, 0.32, 0, f * 1.25);
      } else {
        // Tríada completa
        notes.forEach((f, i) => {
          this._tone(f, 'triangle', 0.45, 0.28, i * 0.055);
        });
      }
    }

    playOverdriveStart() {
      if (!this._canPlay()) return;
      const arp = [293.66, 440.00, 587.33, 740.00, 880.00, 1174.66];
      arp.forEach((f, i) => {
        this._tone(f, 'triangle', 0.36, 0.25, i * 0.045);
      });
    }

    playDamage() {
      if (!this._canPlay()) return;
      this._tone(155, 'sawtooth', 0.32, 0.38, 0, 58);
      this._tone(116, 'square', 0.28, 0.26, 0.03, 46);
    }

    playLevelUp() {
      if (!this._canPlay()) return;
      const notes = [392.00, 493.88, 587.33, 783.99];
      notes.forEach((f, i) => {
        this._tone(f, 'triangle', 0.30, 0.24, i * 0.06);
      });
    }

    playGameOver() {
      if (!this._canPlay()) return;
      const notes = [440.00, 392.00, 349.23, 293.66, 220.00];
      notes.forEach((f, i) => {
        this._tone(f, 'sawtooth', 0.38, 0.22, i * 0.11, f * 0.96);
      });
    }
  }

  global.SyntoniaAudio = new SoundEngine();
})(window);
