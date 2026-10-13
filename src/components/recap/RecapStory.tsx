"use client";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Copy, Flame, Footprints, Home, Moon, Scale, Sparkles, Trophy, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatedNumber, clsx, haptic } from "@/components/ui";
import { fmtDay, fmtNum, kgToLb, type UnitSystem } from "@/lib/client/format";
import { FOCUS_TEXT, recapText, showedUpLine, type Recap } from "./compute";

type Tone = "brand" | "cal" | "steps" | "sleep";
const TONE: Record<Tone, [string, string]> = {
  brand: ["--brand-a", "--brand-b"],
  cal: ["--c-cal", "--brand-a"],
  steps: ["--c-steps", "--brand-b"],
  sleep: ["--c-sleep", "--brand-b"],
};

interface SlideDef {
  id: string;
  title: string;
  eyebrow: string;
  icon: LucideIcon;
  tone: Tone;
  /** The one big number (or title). */
  big: (seen: boolean) => ReactNode;
  unit?: string;
  sub?: ReactNode;
  extra?: ReactNode;
  sentence: string;
}

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Counts up the first time its card is seen; always readable as plain text. */
function Big({ value, seen, format }: { value: number; seen: boolean; format?: (n: number) => string }) {
  const f = format ?? ((n: number) => Math.round(n).toLocaleString("en-US"));
  return seen ? <AnimatedNumber value={value} format={f} fromZero duration={900} /> : <span>{f(value)}</span>;
}

/** One dot per day: filled when you showed up (logged anything), an outline when not. */
function DotStrip({ days }: { days: Recap["days"] }) {
  return (
    <ul aria-label="Days you showed up" className="grid grid-cols-7 gap-1.5">
      {days.map((d) => (
        <li key={d.date} className="flex flex-col items-center gap-1.5">
          <span aria-hidden className={clsx("flex h-9 w-9 items-center justify-center rounded-full border-2", d.showed ? "border-transparent text-brand-fg" : "border-fg/25")} style={d.showed ? { background: "var(--btn-bg)" } : undefined}>
            {d.showed && <Check className="h-4 w-4" />}
          </span>
          <span aria-hidden className="text-[11px] font-semibold text-fg/75">{d.initial}</span>
          <span className="sr-only">{d.weekday}: {d.showed ? "you showed up" : "nothing logged"}</span>
        </li>
      ))}
    </ul>
  );
}

const pl = (n: number, one: string, many: string) => (n === 1 ? one : many);

function buildSlides(r: Recap, units: UnitSystem, name: string | null, copy: { copied: boolean; onCopy: () => void }): SlideDef[] {
  const u = units === "IMPERIAL" ? "lb" : "kg";
  const wv = (kg: number) => (units === "IMPERIAL" ? kgToLb(kg) : kg);
  const range = `${fmtDay(r.from, { day: "numeric", month: "short" })} to ${fmtDay(r.to, { day: "numeric", month: "short" })}`;
  const first = name?.split(" ")[0];
  const day = (d: string) => fmtDay(d, { weekday: "long" });
  const total = r.days.length;
  const slides: SlideDef[] = [];

  slides.push({
    id: "intro", title: "Your week", eyebrow: "Your week, wrapped", icon: Sparkles, tone: "brand",
    big: () => <span className="display block text-[3.75rem] font-extrabold leading-[0.95] tracking-tight">Your<br />week.</span>,
    sub: <span className="text-lg font-semibold">{range}</span>,
    sentence: `${first ? `${first}, here's` : "Here's"} what showing up looked like, in a few quick cards. Swipe to see.`,
    extra: <p className="flex items-center gap-1.5 text-sm font-semibold text-fg/75">Swipe or use the arrow keys <ArrowRight className="h-4 w-4" aria-hidden /></p>,
  });

  slides.push({
    id: "showed", title: "Days you showed up", eyebrow: "Showing up", icon: Check, tone: "brand",
    big: (seen) => <Big value={r.daysShowed} seen={seen} />,
    unit: `of ${total} days`,
    sub: r.prevDaysShowed != null ? <span>Last week: {r.prevDaysShowed} {pl(r.prevDaysShowed, "day", "days")}</span> : undefined,
    extra: <DotStrip days={r.days} />,
    sentence: showedUpLine(r.daysShowed, total),
  });

  if (r.fuel) {
    const f = r.fuel;
    const hit = f.proteinHitDays;
    const delta = f.deltaCalories != null && Math.abs(f.deltaCalories) >= 25 ? f.deltaCalories : null;
    slides.push({
      id: "fuel", title: "Fuel", eyebrow: "Fuel", icon: Flame, tone: "cal",
      big: (seen) => <Big value={f.avgCalories} seen={seen} />,
      unit: "kcal a day, est.",
      sub: (
        <span className="block space-y-0.5">
          {f.avgProtein != null && <span className="block">Protein averaged {fmtNum(f.avgProtein)} g a day</span>}
          {hit != null && <span className="block">Protein goal reached on {hit} of {f.loggedDays} logged {pl(f.loggedDays, "day", "days")}</span>}
          {delta != null && <span className="block">About {fmtNum(Math.abs(delta))} kcal a day {delta > 0 ? "more" : "less"} than last week</span>}
        </span>
      ),
      sentence: hit != null && f.avgProtein != null && hit >= Math.ceil(f.loggedDays * 0.6)
        ? `Protein landed on target ${hit} of ${f.loggedDays} logged days. Steady fuel, steady progress.`
        : `You fuelled ${f.loggedDays} ${pl(f.loggedDays, "day", "days")} with real numbers behind it. That's what makes the rest useful.`,
    });
  }

  if (r.move) {
    const m = r.move;
    slides.push({
      id: "move", title: "Move", eyebrow: "Move", icon: Footprints, tone: "steps",
      big: (seen) => <Big value={m.avgSteps} seen={seen} />,
      unit: "steps a day",
      sub: <span>Best day: {day(m.best.date)}, {fmtNum(m.best.steps)} steps</span>,
      sentence: m.daysAtGoal != null && m.daysAtGoal >= 3
        ? `You reached your step goal on ${m.daysAtGoal} days. Your legs have been busy.`
        : `Every step counts, and ${day(m.best.date)} was your standout.`,
    });
  }

  if (r.train) {
    const t = r.train;
    const vol = Math.round(wv(t.volumeKg));
    slides.push({
      id: "train", title: "Train", eyebrow: "Train", icon: Trophy, tone: "brand",
      big: (seen) => <Big value={t.sessions} seen={seen} />,
      unit: pl(t.sessions, "training day", "training days"),
      sub: (
        <span className="block space-y-1">
          {vol > 0 && <span className="block">{fmtNum(vol)} {u} lifted in total</span>}
          {t.prs.length > 0 && (
            <span className="mt-2 block rounded-2xl border border-brand/40 bg-surface/60 px-3.5 py-2.5 shadow-glow">
              <span className="flex items-center gap-1.5 font-bold"><Trophy className="h-4 w-4 text-brand" aria-hidden /> {t.prs.length === 1 ? "A new personal best" : `${t.prs.length} new personal bests`}</span>
              <span className="mt-0.5 block text-sm">{t.prs.slice(0, 3).map((p) => p.title).join(" · ")}</span>
            </span>
          )}
        </span>
      ),
      sentence: t.sessions >= 3 ? "A strong week under the bar." : t.sessions >= 1 ? "You trained, and that's the habit that matters most." : "Your records are in the books.",
    });
  }

  if (r.recover) {
    const c = r.recover;
    slides.push({
      id: "recover", title: "Recover", eyebrow: "Recover", icon: Moon, tone: "sleep",
      big: (seen) => <Big value={c.avgSleep} seen={seen} format={(n) => fmtNum(n, 1)} />,
      unit: "hours a night",
      sub: <span>Best night: {day(c.best.date)}, {fmtNum(c.best.hours, 1)} h</span>,
      sentence: c.nightsAtTarget != null && c.nightsAtTarget >= 4
        ? `You hit your sleep target on ${c.nightsAtTarget} nights. Rest is where you get stronger.`
        : "Sleep is the quiet multiplier. Even small, regular gains show up in how you train and eat.",
    });
  }

  if (r.weight) {
    const wt = r.weight;
    const avg = wv(wt.avgKg);
    const d = wt.deltaKg != null ? wv(wt.deltaKg) : null;
    const flat = d != null && Math.abs(d) < (units === "IMPERIAL" ? 0.3 : 0.15);
    slides.push({
      id: "weight", title: "Weight", eyebrow: "Weight · weekly average", icon: Scale, tone: "brand",
      big: (seen) => d != null
        ? <Big value={d} seen={seen} format={(n) => `${n > 0.049 ? "+" : n < -0.049 ? "−" : ""}${fmtNum(Math.abs(n), 1)}`} />
        : <Big value={avg} seen={seen} format={(n) => fmtNum(n, 1)} />,
      unit: d != null ? `${u} on your weekly average` : `${u} average this week`,
      sub: <span>{d != null ? `This week's average: ${fmtNum(avg, 1)} ${u}. ` : ""}{wt.weighIns} {pl(wt.weighIns, "weigh-in", "weigh-ins")}. Trend, not single days.</span>,
      sentence: d == null
        ? "Weigh in again next week and I'll show you the trend. One week at a time is plenty."
        : flat ? "Steady. Your average barely moved, and that's a signal in itself."
        : d < 0 ? "Your average dipped. Daily numbers bounce with water and food; this is the trend that counts."
        : "Your average nudged up, which is well within normal week-to-week movement. Zoom out, not in.",
    });
  }

  const focus = FOCUS_TEXT[r.focus];
  slides.push({
    id: "next", title: "Next week", eyebrow: "An invitation for next week", icon: Sparkles, tone: "brand",
    big: () => <span className="display block text-[2.6rem] font-extrabold leading-[1.05] tracking-tight">{focus.title}</span>,
    sentence: focus.body,
    extra: (
      <div className="space-y-2.5">
        <button type="button" className="btn !min-h-[56px] w-full bg-surface/80" onClick={copy.onCopy}>
          {copy.copied ? <Check className="h-5 w-5 text-good" aria-hidden /> : <Copy className="h-5 w-5" aria-hidden />} {copy.copied ? "Copied to clipboard" : "Copy summary"}
        </button>
        <Link href="/" className="btn btn-primary !min-h-[56px] w-full" onClick={() => haptic()}><Home className="h-5 w-5" aria-hidden /> Back to Today</Link>
      </div>
    ),
  });
  return slides;
}

function SlideCard({ def, index, total, seen, setRef }: { def: SlideDef; index: number; total: number; seen: boolean; setRef: (el: HTMLElement | null) => void }) {
  const [a, b] = TONE[def.tone];
  const Icon = def.icon;
  return (
    <article
      ref={setRef}
      tabIndex={0}
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${total}: ${def.title}`}
      className="rise relative flex min-h-[clamp(27rem,calc(100svh-17rem),40rem)] w-[88%] shrink-0 snap-start flex-col justify-between gap-6 overflow-hidden rounded-[2rem] border border-border p-6 md:w-[26rem]"
      style={{
        ["--i" as string]: Math.min(index, 7),
        background: `radial-gradient(130% 75% at 0% 0%, rgb(var(${a}) / 0.34), transparent 64%), radial-gradient(90% 60% at 100% 100%, rgb(var(${b}) / 0.2), transparent 68%), rgb(var(--surface))`,
      }}
    >
      <Icon aria-hidden className="pointer-events-none absolute -bottom-6 -right-6 h-44 w-44 opacity-[0.06]" strokeWidth={1.25} />
      <p className="eyebrow flex items-center gap-2 !text-fg/75"><Icon className="h-4 w-4" aria-hidden /> {def.eyebrow}</p>

      <div className="min-w-0">
        <p className="num text-[5rem] leading-none md:text-[6rem]">{def.big(seen)}</p>
        {def.unit && <p className="mt-2 text-lg font-semibold">{def.unit}</p>}
        {def.sub && <div className="mt-3 text-sm text-fg/80">{def.sub}</div>}
      </div>

      <div className="space-y-4">
        {def.extra}
        <p className="display text-[1.3rem] font-bold leading-snug">{def.sentence}</p>
      </div>
    </article>
  );
}

/**
 * The story: horizontal scroll-snap cards (one per screen, the next one peeking), page dots, arrow-key navigation.
 * Every card is a focusable article whose content is plain text, so it reads well to screen readers too.
 */
export function RecapStory({ recap, units, name }: { recap: Recap; units: UnitSystem; name: string | null }) {
  const scroller = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const raf = useRef(0);
  const [active, setActive] = useState(0);
  const [seen, setSeen] = useState<Set<number>>(() => new Set([0]));
  const [copied, setCopied] = useState(false);
  const prevActive = useRef(0);

  const onCopy = useCallback(async () => {
    const text = recapText(recap, units);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* clipboard unavailable */
      }
      document.body.removeChild(ta);
    }
    haptic("success");
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }, [recap, units]);

  const slides = buildSlides(recap, units, name, { copied, onCopy: () => void onCopy() });
  const total = slides.length;

  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const edge = el.getBoundingClientRect().left + parseFloat(getComputedStyle(el).paddingLeft || "0");
    let best = 0;
    let bestD = Infinity;
    cards.current.forEach((c, i) => {
      if (!c) return;
      const d = Math.abs(c.getBoundingClientRect().left - edge);
      if (d < bestD) {
        best = i;
        bestD = d;
      }
    });
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 2) best = cards.current.filter(Boolean).length - 1;
    setActive(best);
  }, []);
  const onScroll = () => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(measure);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  useEffect(() => {
    setSeen((s) => (s.has(active) ? s : new Set(s).add(active)));
    if (prevActive.current !== active) {
      haptic();
      prevActive.current = active;
    }
  }, [active]);

  const goTo = useCallback((i: number, focus = false) => {
    const el = cards.current[Math.min(total - 1, Math.max(0, i))];
    if (!el) return;
    el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", inline: "start", block: "nearest" });
    if (focus) el.focus({ preventScroll: true });
  }, [total]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const k = e.key;
    if (k === "ArrowRight") goTo(active + 1, true);
    else if (k === "ArrowLeft") goTo(active - 1, true);
    else if (k === "Home") goTo(0, true);
    else if (k === "End") goTo(total - 1, true);
    else return;
    e.preventDefault();
  };

  return (
    <div>
      <div className="sr-only" role="status" aria-live="polite">{copied ? "Summary copied to clipboard." : ""}</div>
      <div className="-mx-4 md:-mx-8">
        <div
          ref={scroller}
          role="region"
          aria-roledescription="carousel"
          aria-label="Your week, wrapped. Use the left and right arrow keys to move between cards."
          onScroll={onScroll}
          onKeyDown={onKeyDown}
          className="flex snap-x snap-mandatory scroll-pl-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pb-3 scrollbar-none md:scroll-pl-8 md:px-8"
        >
          {slides.map((s, i) => (
            <SlideCard key={s.id} def={s} index={i} total={total} seen={seen.has(i)} setRef={(el) => { cards.current[i] = el; }} />
          ))}
          <div aria-hidden className="w-1 shrink-0" />
        </div>
      </div>

      <div className="mt-2 flex items-center justify-center gap-1">
        <button type="button" className="btn btn-ghost hidden !min-h-[48px] !min-w-[48px] !px-2 md:inline-flex" onClick={() => goTo(active - 1, true)} disabled={active === 0} aria-label="Previous card"><ChevronLeft className="h-5 w-5" aria-hidden /></button>
        <div role="group" aria-label="Choose a card" className="flex items-center">
          {slides.map((s, i) => (
            <button key={s.id} type="button" onClick={() => goTo(i, true)} aria-label={`Card ${i + 1} of ${total}: ${s.title}`} aria-current={i === active ? "true" : undefined} className="press flex h-12 min-w-[26px] items-center justify-center px-1">
              <span aria-hidden className={clsx("block h-2 rounded-full transition-all duration-300", i === active ? "w-6 bg-brand" : "w-2 bg-fg/25")} />
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-ghost hidden !min-h-[48px] !min-w-[48px] !px-2 md:inline-flex" onClick={() => goTo(active + 1, true)} disabled={active === total - 1} aria-label="Next card"><ChevronRight className="h-5 w-5" aria-hidden /></button>
      </div>
    </div>
  );
}
