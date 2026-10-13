"use client";
import { Activity, BarChart3, Dumbbell, Home, LayoutDashboard, LineChart, MessageCircle, Scale, Settings, Salad, History, TrendingUp, WifiOff } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { clsx, haptic } from "@/components/ui";
import { useCoach } from "@/components/coach/CoachProvider";
import { VoiceSheet } from "@/components/coach/VoiceSheet";
import { useApi } from "@/lib/client/api";
import { NotificationBell } from "./NotificationBell";
import { ThemeToggle } from "./ThemeToggle";

const SIDEBAR = [
  { href: "/", label: "Today", icon: Home },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/nutrition", label: "Nutrition", icon: Salad },
  { href: "/weight", label: "Weight", icon: Scale },
  { href: "/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/coach", label: "AI Coach", icon: MessageCircle },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

const BOTTOM = [
  { href: "/", label: "Home", icon: Home },
  { href: "/nutrition", label: "Log", icon: Salad },
  { href: "/workouts", label: "Workout", icon: Dumbbell },
  { href: "/progress", label: "Progress", icon: LineChart },
  { href: "/coach", label: "Coach", icon: MessageCircle },
] as const;

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

function Logo({ className }: { className?: string }) {
  return (
    <span className={clsx("grad-brand flex items-center justify-center rounded-xl text-brand-fg shadow-tile", className)}>
      <Activity className="h-[55%] w-[55%]" aria-hidden />
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { online, queued } = useCoach();
  const gymMode = path.startsWith("/workouts/session");
  const { data: profile } = useApi<{ profile: { onboarded: boolean } }>("/api/profile");

  // Conversational onboarding replaces a giant sign-up form: send new users there first.
  useEffect(() => {
    if (profile && !profile.profile.onboarded) router.replace("/onboarding");
  }, [profile, router]);

  return (
    <div className="min-h-screen md:flex">
      <a href="#main" className="sr-only-focusable fixed left-2 top-2 z-[60] rounded-xl bg-brand px-3 py-2 text-brand-fg">Skip to content</a>

      {/* Desktop sidebar */}
      <aside className="glass sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border p-4 md:flex" aria-label="Main">
        <Link href="/" className="mb-7 flex items-center gap-3 px-2">
          <Logo className="h-10 w-10" />
          <span className="display text-xl font-extrabold tracking-tight">Sukoon<span className="text-grad">Fit</span></span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {SIDEBAR.map(({ href, label, icon: Icon }) => {
            const active = isActive(path, href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined}
                className={clsx("press group relative flex min-h-[46px] items-center gap-3 rounded-2xl px-3.5 text-sm font-semibold transition-colors", active ? "bg-brand/12 text-brand" : "text-muted hover:bg-surface-2 hover:text-fg")}>
                {active && <span aria-hidden className="absolute -left-4 top-2.5 h-6 w-1 rounded-r-full grad-brand" />}
                <Icon className="h-5 w-5" aria-hidden /> {label}
              </Link>
            );
          })}
        </nav>
        <p className="rounded-2xl bg-surface-2 px-3.5 py-3 text-xs text-muted">Calories and body fat are <span className="font-semibold text-fg">estimates</span>, not measurements.</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass pt-safe sticky top-0 z-30 flex items-center justify-between border-b border-border/70 px-4 py-2 md:bg-transparent md:px-8 md:[backdrop-filter:none]">
          <Link href="/" className="flex items-center gap-2.5 md:hidden">
            <Logo className="h-8 w-8" />
            <span className="display text-lg font-extrabold tracking-tight">Sukoon<span className="text-grad">Fit</span></span>
          </Link>
          <div className="hidden md:block" />
          <div className="flex items-center gap-1">
            {(!online || queued > 0) && (
              <span role="status" className="mr-1 inline-flex items-center gap-1 rounded-full bg-warn/15 px-2.5 py-1 text-xs font-semibold text-warn">
                <WifiOff className="h-3.5 w-3.5" aria-hidden /> {online ? `${queued} syncing` : "Offline"}
              </span>
            )}
            <NotificationBell />
            <ThemeToggle />
          </div>
        </header>

        <main id="main" tabIndex={-1} className={clsx("mx-auto w-full max-w-6xl flex-1 px-4 pt-4 outline-none md:px-8 md:pb-28 md:pt-6", gymMode ? "pb-8" : "pb-40")}>{children}</main>
      </div>

      {/* Mobile: floating tab bar in the thumb zone */}
      {!gymMode && (
      <nav aria-label="Main" className="glass fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 grid grid-cols-5 rounded-[1.75rem] border border-border p-1.5 shadow-float md:hidden">
        {BOTTOM.map(({ href, label, icon: Icon }) => {
          const active = isActive(path, href);
          return (
            <Link key={href} href={href} aria-current={active ? "page" : undefined} onClick={() => haptic()}
              className={clsx("press relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-[1.25rem] text-[10.5px] font-semibold transition-colors", active ? "text-brand" : "text-muted")}>
              {active && <span aria-hidden className="absolute inset-0 rounded-[1.25rem] bg-brand/12 pop" />}
              <Icon className={clsx("relative h-[22px] w-[22px] transition-transform duration-300 ease-out", active && "-translate-y-px scale-110")} aria-hidden />
              <span className="relative">{label}</span>
            </Link>
          );
        })}
      </nav>
      )}

      <VoiceSheet />
    </div>
  );
}
