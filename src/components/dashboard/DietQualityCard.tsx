import { ProgressBar, type RingColor } from "@/components/ui";
import { fmtNum } from "@/lib/client/format";
import type { TodayDto } from "@/lib/client/types";

/** One guidance row: value, the suggested range, and a words-first read of where you are. Suggestions, never rules. */
function GuidanceRow({ label, value, unit, lo, hi, dp = 0, color }: { label: string; value: number; unit: string; lo: number; hi: number; dp?: number; color: RingColor }) {
  const read = value < lo ? `a little under the ${lo}–${hi} suggestion` : value > hi ? `above the ${lo}–${hi} suggestion, which is fine` : `within the ${lo}–${hi} suggestion`;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <dt className="font-semibold">{label}</dt>
        <dd className="text-muted"><span className="num !text-base text-fg">{fmtNum(value, dp)}</span> {unit}</dd>
      </div>
      <div className="mt-1.5"><ProgressBar value={value} max={hi} label={`${label}: ${fmtNum(value, dp)} ${unit}`} color={color} /></div>
      <p className="mt-1 text-xs text-muted">{read}</p>
    </div>
  );
}

export function DietQualityCard({ dq }: { dq: TodayDto["dietQuality"] }) {
  return (
    <section className="card rise space-y-4" aria-labelledby="dq-h">
      <h2 id="dq-h" className="display text-lg font-extrabold">Diet quality</h2>
      {dq ? (
        <>
          <p className="text-sm leading-relaxed">{dq.text}</p>
          <dl className="space-y-4">
            <GuidanceRow label="Vegetables" value={dq.vegPerDay} unit="servings/day" lo={2} hi={3} dp={1} color="good" />
            <GuidanceRow label="Fruit" value={dq.fruitPerDay} unit="servings/day" lo={1} hi={2} dp={1} color="good" />
            <GuidanceRow label="Fibre" value={dq.avgFiber} unit="g/day" lo={25} hi={35} color="fiber" />
          </dl>
          <p className="text-xs text-muted">Rough guidance: 200–300 g of vegetables (about 2–3 servings), 1–2 pieces of fruit and 25–35 g of fibre a day. Averages over the last 7 days; all are suggestions, and rice, potatoes and bread are welcome.</p>
        </>
      ) : (
        <p className="text-sm text-muted">Log food on at least 3 days this week and I&apos;ll share a quick read on protein, vegetables, fruit and fibre.</p>
      )}
    </section>
  );
}
