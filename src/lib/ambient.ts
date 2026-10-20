// Background sounds for the listening view, made in the browser from filtered noise:
// no audio files, nothing to license, and they work offline.
export const AMBIENTS = [
  { id: "hujan", label: "Hujan" },
  { id: "angin", label: "Angin" },
  { id: "ombak", label: "Ombak" },
  { id: "sungai", label: "Sungai" },
] as const;
export type AmbientId = (typeof AMBIENTS)[number]["id"];
export const isAmbient = (v: unknown): v is AmbientId => AMBIENTS.some((a) => a.id === v);

type Color = "white" | "pink" | "brown";
// short on purpose: generating the buffers blocks the main thread, and a phone does ~8 s of stereo noise × 3 colours in a visible hitch
const SECONDS = 4;
const FADE = 0.5;

// a few seconds of noise whose end is cross-faded into its start, so looping it never clicks
function noiseBuffer(ctx: AudioContext, color: Color): AudioBuffer {
  const rate = ctx.sampleRate;
  const len = rate * SECONDS;
  const fade = Math.floor(rate * FADE);
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const raw = new Float32Array(len + fade);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (let i = 0; i < raw.length; i++) {
      const w = Math.random() * 2 - 1;
      if (color === "white") raw[i] = w * 0.5;
      else if (color === "brown") {
        last = (last + 0.02 * w) / 1.02;
        raw[i] = last * 3.5;
      } else {
        // Paul Kellet's pink noise filter
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        raw[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    }
    const out = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) out[i] = i < fade ? raw[i] * (i / fade) + raw[len + i] * (1 - i / fade) : raw[i];
  }
  return buf;
}

type Graph = { sources: AudioScheduledSourceNode[] };

function build(ctx: AudioContext, id: AmbientId, out: AudioNode, noise: (c: Color) => AudioBuffer): Graph {
  const sources: AudioScheduledSourceNode[] = [];
  const src = (c: Color) => {
    const s = ctx.createBufferSource();
    s.buffer = noise(c);
    s.loop = true;
    // start each layer at a different point so they never line up
    s.start(0, Math.random() * SECONDS);
    sources.push(s);
    return s;
  };
  const filter = (type: BiquadFilterType, freq: number, q = 0.7) => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  };
  const gain = (v: number) => {
    const g = ctx.createGain();
    g.gain.value = v;
    return g;
  };
  // slow sine wobble added onto an AudioParam
  const lfo = (param: AudioParam, hz: number, depth: number) => {
    const o = ctx.createOscillator();
    o.frequency.value = hz;
    const d = gain(depth);
    o.connect(d).connect(param);
    o.start();
    sources.push(o);
  };
  const chain = (...nodes: AudioNode[]) => nodes.reduce((a, b) => a.connect(b));

  if (id === "hujan") {
    chain(src("pink"), filter("highpass", 700), filter("lowpass", 9000), gain(0.9), out);
    chain(src("brown"), filter("lowpass", 350), gain(0.35), out);
    const patter = gain(0.25);
    chain(src("white"), filter("bandpass", 4200, 1.2), patter, out);
    lfo(patter.gain, 7.3, 0.08);
  } else if (id === "angin") {
    const band = filter("bandpass", 420, 0.9);
    const level = gain(0.9);
    chain(src("brown"), band, level, out);
    lfo(band.frequency, 0.07, 260);
    lfo(level.gain, 0.11, 0.35);
    const whistle = filter("bandpass", 900, 6);
    chain(src("pink"), whistle, gain(0.12), out);
    lfo(whistle.frequency, 0.05, 300);
  } else if (id === "ombak") {
    const swell = gain(0.5);
    chain(src("pink"), filter("lowpass", 1100), swell, out);
    lfo(swell.gain, 0.09, 0.45);
    chain(src("brown"), filter("lowpass", 250), gain(0.4), out);
  } else {
    const babble = filter("bandpass", 1600, 0.8);
    chain(src("white"), babble, gain(0.5), out);
    lfo(babble.frequency, 0.6, 350);
    chain(src("pink"), filter("highpass", 300), filter("lowpass", 3000), gain(0.4), out);
  }
  return { sources };
}

// One player for the whole page. Must be unlocked from a tap before iOS lets it make sound.
export class Ambient {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<Color, AudioBuffer>();
  private current: { id: AmbientId; graph: Graph; fade: GainNode } | null = null;

  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
  }

  setVolume(v: number) {
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1);
  }

  play(id: AmbientId, volume: number) {
    this.unlock();
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    this.setVolume(volume);
    if (this.current?.id === id) return;
    this.stop();
    const fade = ctx.createGain();
    fade.gain.value = 0;
    fade.connect(this.master);
    fade.gain.setTargetAtTime(1, ctx.currentTime, 0.6);
    const noise = (c: Color) => {
      let b = this.buffers.get(c);
      if (!b) this.buffers.set(c, (b = noiseBuffer(ctx, c)));
      return b;
    };
    this.current = { id, graph: build(ctx, id, fade, noise), fade };
  }

  stop() {
    const ctx = this.ctx;
    const cur = this.current;
    if (!ctx || !cur) return;
    this.current = null;
    cur.fade.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    const end = ctx.currentTime + 1.5;
    for (const s of cur.graph.sources) s.stop(end);
    setTimeout(() => cur.fade.disconnect(), 1600);
  }

  close() {
    this.stop();
    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.master = null;
    this.buffers.clear();
  }
}
