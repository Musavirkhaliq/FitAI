"use client";

/** Strip markdown / symbols that sound bad when read aloud. Mirrors the server's speakable(). */
export function speakable(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_`#>|]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Streams speech sentence by sentence as the reply arrives. Uses Google Cloud TTS through /api/tts and
 * falls back to the browser's Web Speech API when the cloud voice is unavailable (501/502/offline).
 * cancel() stops everything immediately — that is what makes interruption (barge-in) feel instant.
 */
export class SentenceSpeaker {
  private buffer = "";
  private queue: string[] = [];
  private running = false;
  private epoch = 0;
  private audio: HTMLAudioElement | null = null;
  private abort: AbortController | null = null;
  private cloud = true;
  speaking = false;
  onChange?: (speaking: boolean) => void;

  private set(v: boolean) {
    if (this.speaking !== v) {
      this.speaking = v;
      this.onChange?.(v);
    }
  }

  feed(token: string) {
    this.buffer += token;
    // Split off complete sentences; keep the unfinished tail in the buffer.
    const re = /[^.!?\n]*[.!?]+(?=\s|$)|[^\n]*\n+/g;
    let m: RegExpExecArray | null;
    let last = 0;
    while ((m = re.exec(this.buffer))) {
      const s = speakable(m[0]);
      if (s.length > 2) this.queue.push(s);
      last = re.lastIndex;
    }
    this.buffer = this.buffer.slice(last);
    void this.run();
  }

  /** Speak whatever is left (call when the reply stream ends). */
  flush() {
    const s = speakable(this.buffer);
    this.buffer = "";
    if (s.length > 2) this.queue.push(s);
    void this.run();
  }

  /** Speak a complete one-off phrase (e.g. "Are you still there?"). */
  say(text: string) {
    this.queue.push(speakable(text));
    void this.run();
  }

  cancel() {
    this.epoch++;
    this.queue = [];
    this.buffer = "";
    this.abort?.abort();
    if (this.audio) {
      this.audio.pause();
      this.audio.src = "";
      this.audio = null;
    }
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    this.running = false;
    this.set(false);
  }

  private async run() {
    if (this.running) return;
    this.running = true;
    const epoch = this.epoch;
    this.set(true);
    let next = this.queue.length ? this.fetchAudio(this.queue[0]) : null;
    while (this.queue.length && epoch === this.epoch) {
      const text = this.queue.shift()!;
      const blob = await (next ?? this.fetchAudio(text));
      // Prefetch the following sentence while this one plays.
      next = this.queue.length ? this.fetchAudio(this.queue[0]) : null;
      if (epoch !== this.epoch) return;
      if (blob) await this.play(blob, epoch);
      else await this.browserSpeak(text, epoch);
    }
    if (epoch === this.epoch) {
      this.running = false;
      this.set(false);
    }
  }

  private async fetchAudio(text: string): Promise<Blob | null> {
    if (!this.cloud) return null;
    this.abort = new AbortController();
    try {
      const res = await fetch("/api/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }), signal: this.abort.signal });
      if (res.status === 501 || res.status === 502) {
        this.cloud = false; // don't keep hammering an unconfigured/failed provider this session
        return null;
      }
      return res.ok ? await res.blob() : null;
    } catch {
      return null;
    }
  }

  private play(blob: Blob, epoch: number): Promise<void> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      this.audio = a;
      const done = () => {
        URL.revokeObjectURL(url);
        if (this.audio === a) this.audio = null;
        resolve();
      };
      a.onended = done;
      a.onerror = done;
      if (epoch !== this.epoch) return done();
      a.play().catch(done);
    });
  }

  private browserSpeak(text: string, epoch: number): Promise<void> {
    return new Promise((resolve) => {
      if (typeof speechSynthesis === "undefined" || epoch !== this.epoch) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.98;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      speechSynthesis.speak(u);
    });
  }
}
