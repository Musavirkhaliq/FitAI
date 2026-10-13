import { ChevronRight, Sparkles } from "lucide-react";
import Link from "next/link";

/** Prominent entry to the weekly story at /recap. */
export function RecapLink() {
  return (
    <Link
      href="/recap"
      className="press rise group relative flex min-h-[88px] items-center gap-4 overflow-hidden rounded-[1.5rem] border border-brand/30 p-4 shadow-tile"
      style={{ background: "linear-gradient(135deg, rgb(var(--brand-a) / 0.2), rgb(var(--brand-b) / 0.08) 65%), rgb(var(--surface))", ["--i" as string]: 1 }}
    >
      <span className="grad-brand flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-brand-fg" style={{ boxShadow: "var(--glow)" }}>
        <Sparkles className="h-6 w-6" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="display block text-xl font-extrabold leading-tight">Your week, wrapped</span>
        <span className="mt-0.5 block text-sm text-muted">A short look back at what you showed up for.</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}
