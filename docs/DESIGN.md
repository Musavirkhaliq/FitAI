# SukoonFit: design system and product-feel brief

Goal: an app people *want* to open every morning: premium, calm, fast, and honest. We earn habit through value, never through guilt.
Everything here is mobile-first (design at 390 px, then widen). Desktop is the same app with more room, not a different one.

## 1. Research → decisions

| Finding (source: search + Smashing Magazine streak guide) | Decision |
|---|---|
| ~70% of calorie-tracker users quit in 2 weeks; **seconds per meal** predicts retention | One-tap voice, text, **"log again" chips**, frequent foods, repeat-last-meal. Every log path ≤ 2 taps. |
| Thumb zone: primary actions in the bottom ~30%, nav at the bottom, destructive actions harder to reach | Floating bottom tab bar, big orb docked bottom-right, destructive actions live in sheets with a confirm. ≥ 48 px targets, 8 px gaps. |
| Streaks work via habit + loss aversion, but guilt/anxiety is exploitative. Prefer tiny actions, **grace/decay not hard resets**, celebrate return, milestones at 7/30/50/100/365 | Forgiving streaks (already built). Copy celebrates showing up; a miss never shames. Calm milestone moments (glow + one line), no confetti storms. |
| Hook model (trigger → action → variable reward → investment), ethical when it serves the user | Trigger: 7–8 am weigh-in reminder. Action: the orb. Variable reward: fresh coach insights, PR moments, the weekly recap. Investment: memory, photos, history, personal plan. No dark patterns, always a graceful exit. |
| Voice UI: audio-reactive orb, distinct states (idle/listening/thinking/speaking/error), live transcript, interruption, **never fake "listening"** | `VoiceOrb` is driven by the real mic level and the real state machine. |
| Bento grid = cognitive chunking; size encodes importance | Today is a bento: one hero (rings), tiles of different sizes. |
| Motion should *communicate*: 100–150 ms feedback, 200–300 ms small, 300–500 ms medium; ease-out; respect reduced motion | Tokens below; every animation has a reduced-motion fallback. |
| "Wrapped"-style recaps boost engagement | `/recap`: a swipeable "Your week" story. |
| Onboarding that ends in a tangible personalised plan | Plan reveal with animated rings and a projected date. |

## 2. Visual language

- **Mood:** deep ink dark mode as the hero experience, airy mint-white light mode. Emerald→cyan brand gradient used sparingly (orb, primary CTA, active tab).
- **Surfaces:** layered, not boxed. `bg` < `surface` < `surface-2` < `surface-3`. Cards have a 1 px hairline and a soft shadow (light) or inner top highlight (dark). Large radii (24 px cards, 20 px tiles, full pills).
- **Glass** only on the tab bar, top bar and sheets (`.glass`), where blur is cheap. Never on long lists.
- **Typography:** Manrope (display, numbers) + Inter (UI text). Scale 12 / 14 / 16 / 20 / 24 / 32 / 48. **One hero number per screen (≥ 48 px).** Big numbers use proportional figures; use `tabular-nums` only for aligned columns/axes.
- **Spacing:** 4-pt grid; page gutter 16 px; section gap 20–24 px.
- **Iconography:** lucide, 20 px, 1.75 stroke.

## 3. Colour tokens (CSS variables, RGB triplets)

Chart/ring colours were **validated with the dataviz validator** (CVD, normal-vision, contrast ≥ 3:1) in both modes, in this fixed order. Never reorder, never cycle, never reuse for another meaning:

| Slot | Meaning | Light | Dark | Token |
|---|---|---|---|---|
| 1 | Calories / fuel | `#eb6834` | `#d95926` | `--c-cal` |
| 2 | Protein | `#2a78d6` | `#3987e5` | `--c-protein` |
| 3 | Steps / move | `#14a06f` | `#199e70` | `--c-steps` |
| 4 | Sleep / recover | `#4a3aa7` | `#9085e9` | `--c-sleep` |
| 5 | Fiber | `#008300` | `#008300` | `--c-fiber` |

Single-series charts (e.g. weight) use `--brand`. Status colours (`good`, `warn`, `bad`) are reserved for state and always ship with an icon + words.
**Text never wears a series colour**: value text uses `fg`/`muted`; a coloured dot or bar sits beside it.

## 4. Chart rules (from the dataviz guidance; non-negotiable)

- **No dual-axis charts.** Two measures of different scale → two stacked charts sharing the x-axis, or small multiples, or index both to 100.
- Lines 2 px round; bars ≤ 24 px with 4 px rounded data-end, square at the baseline; area wash ≈ 10%; end-dots ≥ 8 px with a 2 px surface ring; hairline solid gridlines.
- Label selectively (endpoint/extreme), never a number on every point. Legend for ≥ 2 series, none for 1.
- Every chart keeps its `ChartFrame` text summary + data table. Tooltip on hover/tap with a target larger than the mark.
- Honesty: estimates say "est." and show ranges; weight leads with averages, not single days.

## 5. Motion tokens

`--ease-out: cubic-bezier(.22,1,.36,1)`; durations `--d-fast 140ms`, `--d-base 240ms`, `--d-slow 420ms`, `--d-hero 700ms`.
Patterns: **rise** (8 px + fade, staggered 40 ms) for tiles on entry; **ring draw** from 0 on mount; **count-up** for the hero number (400 ms, once); **press** scale .97 on tap; **orb** breathing at idle. Success feedback = a short checkmark morph + `haptic("success")` where supported.
`prefers-reduced-motion`: no transforms/draws; instant state changes; the orb stays static but still shows state.

## 6. Components (all in `src/components/ui.tsx`, import from there)

`Tile` (bento cell: `span` 1|2, `tone`), `Ring`/`RingCluster` (concentric progress rings with real values), `AnimatedNumber`,
`Sparkline`, `MetricCard`, `Sheet` (grab handle, swipe down, safe-area), `Segmented` (sliding pill), `Chip`, `Badge`, `Skeleton` (shimmer),
`EmptyState`, `ErrorState`, `Notice`, `Toggle`, `Field`, `PageHeader`, `ChartFrame`. Utilities in `globals.css`: `.tile`, `.glass`, `.num`, `.display`, `.rise`, `.press`, `.shimmer`, `.hairline`, `.pb-safe`.
Voice: `VoiceOrb`, `VoicePanel`. App chrome: floating tab bar + docked orb.

## 7. Layout rules

- 390 px first. One column; bento tiles use a 2-column grid with `span-2` for the hero/long tiles; at ≥ 768 px 4 columns; ≥ 1024 px sidebar.
- Primary action of any screen sits in the lower third. Page bottom padding clears the tab bar + orb (`pb-32`).
- Sheets, not modals; bottom-anchored on mobile. Forms: one field per row, large inputs (48 px), `inputMode` set, labels always visible.
- Loading = skeletons that match the final layout. Empty = one sentence + one action. Errors = calm, actionable.

## 8. Tone of voice

Warm, direct, specific. "You showed up 5 days this week" not "You failed 2 days". No exclamation floods, no emoji spam, never moralise about food.
