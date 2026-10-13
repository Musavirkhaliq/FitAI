"use client";

/** Live input level (0–1) as a tiny external store, so only the waveform re-renders at ~20 fps. */
class LevelStore {
  private bars: number[] = Array(40).fill(0);
  private subs = new Set<() => void>();
  private snap = this.bars;
  push(v: number) {
    this.bars = [...this.bars.slice(1), v];
    this.snap = this.bars;
    this.subs.forEach((f) => f());
  }
  reset() {
    this.bars = Array(40).fill(0);
    this.snap = this.bars;
    this.subs.forEach((f) => f());
  }
  subscribe = (f: () => void) => {
    this.subs.add(f);
    return () => this.subs.delete(f);
  };
  getSnapshot = () => this.snap;
}
export const levelStore = new LevelStore();

const MIME_PREFS = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const pickMime = () => (typeof MediaRecorder === "undefined" ? "" : MIME_PREFS.find((m) => MediaRecorder.isTypeSupported(m)) ?? "");

export interface VoiceCallbacks {
  /** First speech detected by voice-activity detection. */
  onSpeechStart?: () => void;
  /** Speech then ~1.5 s of silence: stop and transcribe. */
  onAutoStop?: () => void;
  /** 10 s without any speech: ask "Are you still there?". */
  onNoInput?: () => void;
  /** Gave up waiting (after the prompt), or hit the max duration. */
  onTimeout?: () => void;
}

const SILENCE_MS = 1500;
const NO_INPUT_MS = 10_000;
const GIVE_UP_MS = 20_000;
const MAX_MS = 60_000;

/**
 * One microphone session: getUserMedia → analyser (voice-activity detection + amplitude) → MediaRecorder.
 * The stream stays open for the whole exchange so the user can interrupt a spoken reply; close() releases it.
 */
export class VoiceSession {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private tick: ReturnType<typeof setInterval> | null = null;
  private data = new Float32Array(1024);
  private startedAt = 0;
  private noiseFloor = 0.01;
  private calibrated = 0;
  private speechFrames = 0;
  private lastVoiceAt = 0;
  private spoke = false;
  private prompted = false;
  private interruptFrames = 0;
  private interruptCb: (() => void) | null = null;
  mime = "";

  constructor(private cb: VoiceCallbacks = {}) {}

  get active() {
    return !!this.stream;
  }

  async open() {
    if (this.stream) return;
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser can't access the microphone. Type your entry instead.");
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    src.connect(this.analyser);
    this.tick = setInterval(() => this.sample(), 50);
  }

  private rms(): number {
    if (!this.analyser) return 0;
    this.analyser.getFloatTimeDomainData(this.data);
    let sum = 0;
    for (let i = 0; i < this.data.length; i++) sum += this.data[i] * this.data[i];
    return Math.sqrt(sum / this.data.length);
  }

  private sample() {
    const level = this.rms();
    const now = performance.now();
    const threshold = Math.max(0.018, this.noiseFloor * 2.4 + 0.008);

    // Learn the room's noise floor during the first ~400 ms of recording.
    if (this.recorder && this.calibrated < 8) {
      this.noiseFloor = (this.noiseFloor * this.calibrated + level) / (this.calibrated + 1);
      this.calibrated++;
    }
    levelStore.push(Math.min(1, level * 9));

    // Barge-in: sustained speech while the assistant is talking.
    if (this.interruptCb) {
      this.interruptFrames = level > Math.max(0.045, threshold * 1.6) ? this.interruptFrames + 1 : 0;
      if (this.interruptFrames >= 6) {
        const cb = this.interruptCb;
        this.interruptCb = null;
        cb();
      }
    }

    if (!this.recorder) return;
    const elapsed = now - this.startedAt;
    if (level > threshold) {
      this.speechFrames++;
      this.lastVoiceAt = now;
      if (!this.spoke && this.speechFrames >= 3) {
        this.spoke = true;
        this.cb.onSpeechStart?.();
      }
    } else {
      this.speechFrames = 0;
    }
    if (this.spoke && now - this.lastVoiceAt > SILENCE_MS) return this.cb.onAutoStop?.();
    if (!this.spoke && elapsed > NO_INPUT_MS && !this.prompted) {
      this.prompted = true;
      this.cb.onNoInput?.();
    }
    if (!this.spoke && elapsed > GIVE_UP_MS) return this.cb.onTimeout?.();
    if (elapsed > MAX_MS) return this.cb.onAutoStop?.();
  }

  startRecording() {
    if (!this.stream) throw new Error("Microphone not open");
    this.chunks = [];
    this.spoke = false;
    this.prompted = false;
    this.speechFrames = 0;
    this.calibrated = 0;
    this.noiseFloor = 0.01;
    this.startedAt = performance.now();
    this.lastVoiceAt = this.startedAt;
    this.mime = pickMime();
    this.recorder = new MediaRecorder(this.stream, this.mime ? { mimeType: this.mime } : undefined);
    this.recorder.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.recorder.start(250);
  }

  /** Stop recording and return the audio (null if nothing useful was captured). */
  stopRecording(): Promise<Blob | null> {
    const rec = this.recorder;
    this.recorder = null;
    if (!rec || rec.state === "inactive") return Promise.resolve(null);
    return new Promise((resolve) => {
      rec.onstop = () => {
        const blob = new Blob(this.chunks, { type: rec.mimeType || this.mime || "audio/webm" });
        this.chunks = [];
        resolve(this.spoke && blob.size > 1500 ? blob : null);
      };
      rec.stop();
    });
  }

  get heardSpeech() {
    return this.spoke;
  }

  /** Watch for the user talking over the assistant; calls back once. */
  watchForInterrupt(cb: () => void) {
    this.interruptFrames = 0;
    this.interruptCb = cb;
  }
  stopWatching() {
    this.interruptCb = null;
  }

  close() {
    if (this.tick) clearInterval(this.tick);
    this.tick = null;
    this.interruptCb = null;
    if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
    this.recorder = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.ctx?.close().catch(() => null);
    this.ctx = null;
    this.analyser = null;
    levelStore.reset();
  }
}
