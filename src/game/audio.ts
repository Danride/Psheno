/* Крошечный WebAudio-синтезатор: все звуки procedural, без файлов. */

class ReaperAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;

  ensure() {
    if (!this.ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.42;
      this.master.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate * 0.5);
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, delay = 0) {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, vol: number, filterFreq: number, type: BiquadFilterType = "lowpass", delay = 0) {
    if (!this.ctx || !this.master || !this.noiseBuf || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  click() {
    this.tone(760, 0.07, "square", 0.12, 980);
  }
  buy() {
    this.tone(520, 0.09, "triangle", 0.16, 780);
    this.tone(1040, 0.12, "triangle", 0.14, 1300, 0.08);
  }
  deny() {
    this.tone(220, 0.14, "sawtooth", 0.12, 140);
  }
  cut(i: number) {
    this.tone(620 + (i % 6) * 70 + Math.random() * 40, 0.07, "triangle", 0.09, 1200);
  }
  hit() {
    this.noise(0.12, 0.22, 900);
    this.tone(180, 0.1, "square", 0.14, 90);
  }
  hurt() {
    this.tone(300, 0.16, "sawtooth", 0.16, 110);
    this.noise(0.1, 0.14, 600);
  }
  kill() {
    this.tone(420, 0.22, "square", 0.16, 70);
    this.tone(840, 0.16, "triangle", 0.12, 140, 0.03);
  }
  levelUp() {
    this.tone(440, 0.1, "triangle", 0.16, 460);
    this.tone(587, 0.1, "triangle", 0.16, 610, 0.09);
    this.tone(880, 0.2, "triangle", 0.18, 920, 0.18);
  }
  dash() {
    this.noise(0.22, 0.16, 1800, "bandpass");
  }
  pickup() {
    this.tone(700, 0.08, "sine", 0.15, 1180);
    this.tone(1400, 0.1, "sine", 0.1, 1900, 0.06);
  }
  death() {
    this.tone(320, 0.7, "sawtooth", 0.2, 50);
    this.noise(0.6, 0.2, 400);
  }
}

export const audio = new ReaperAudio();
