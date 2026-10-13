import { RingCluster } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogoMark } from "./_components/parts";

/** Decorative preview of the product: the three daily rings around a breathing orb. Never announced to screen readers. */
function RingsPreview({ size, stroke }: { size: number; stroke: number }) {
  return (
    <div aria-hidden className="shrink-0">
      <RingCluster
        size={size}
        stroke={stroke}
        gap={Math.max(3, Math.round(stroke / 3.5))}
        summary="Decorative preview of daily calorie, protein and step rings"
        rings={[{ ratio: 0.78, color: "cal" }, { ratio: 0.9, color: "protein" }, { ratio: 0.58, color: "steps" }]}
      >
        <span className="grad-brand block rounded-full motion-safe:animate-breathe" style={{ width: size * 0.2, height: size * 0.2, boxShadow: "0 0 24px rgb(var(--brand-a) / 0.55)" }} />
      </RingCluster>
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-x-hidden px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
      {/* Ambient glow: CSS only, slow and subtle. Decorative. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-28 -top-28 h-80 w-80 rounded-full bg-brand-a/25 blur-3xl motion-safe:animate-breathe" />
        <div className="absolute -right-24 top-36 h-72 w-72 rounded-full bg-brand-b/20 blur-3xl motion-safe:animate-breathe [animation-delay:1.8s]" />
        <div className="absolute -bottom-24 left-1/4 h-72 w-72 rounded-full bg-cal/10 blur-3xl" />
      </div>

      <header className="mx-auto flex w-full max-w-5xl items-center justify-between">
        <div className="flex items-center gap-3">
          <LogoMark className="h-11 w-11" />
          <span className="display text-xl font-extrabold tracking-tight">Sukoon<span className="text-grad">Fit</span></span>
        </div>
        <ThemeToggle />
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-6 py-6 lg:grid lg:grid-cols-2 lg:items-center lg:gap-16">
        <section className="rise flex items-center justify-between gap-4 lg:flex-col lg:items-start lg:justify-center lg:gap-10" aria-label="About SukoonFit">
          <div className="min-w-0">
            <p className="display text-[1.9rem] font-extrabold leading-[1.08] tracking-tight sm:text-[2.4rem] lg:text-5xl">
              Talk. Track.<br />
              <span className="text-grad">Find your sukoon.</span>
            </p>
            <p className="mt-3 max-w-[17rem] text-sm leading-relaxed text-muted sm:max-w-sm sm:text-base">
              Sukoon means calm. Say what you ate, lifted or weighed, and your coach logs it, estimates honestly and plans the rest of your day, without the guilt.
            </p>
          </div>
          <div className="lg:hidden"><RingsPreview size={92} stroke={9} /></div>
          <div className="hidden lg:block"><RingsPreview size={220} stroke={18} /></div>
        </section>

        <div className="mx-auto w-full max-w-[26rem] lg:mx-0 lg:justify-self-end">
          <main id="main" className="w-full">{children}</main>
          <p className="mt-5 text-center text-xs leading-relaxed text-muted">
            SukoonFit is a fitness and nutrition coaching tool, not a medical service. AI can make mistakes. Double-check important results.
          </p>
        </div>
      </div>
    </div>
  );
}
