"use client";
import { Activity, BarChart3, Dumbbell, Home, LayoutDashboard, LineChart, MessageCircle, Scale, Settings, Salad, History, TrendingUp, WifiOff } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { clsx } from "@/components/ui";
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

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { online, queued } = useCoach();
  const { data: profile } = useApi<{ profile: { onboarded: boolean } }>("/api/profile");

  // Conversational onboarding replaces a giant sign-up form: send new users there first.
  useEffect(() => {
    if (profile && !profile.profile.onboarded) router.replace("/onboarding");
  }, [profile, router]);

  return (
    <div className="min-h-screen md:flex">
      <a href="#main" className="sr-only-focusable fixed left-2 top-2 z-[60] rounded-lg bg-brand px-3 py-2 text-brand-fg">Skip to content</a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-border bg-surface/80 p-4 backdrop-blur md:flex" aria-label="Main">
        <Link href="/" className="mb-6 flex items-center gap-2 px-2 text-lg font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-brand-fg"><Activity className="h-5 w-5" aria-hidden /></span>
          FitTrack AI
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {SIDEBAR.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} aria-current={isActive(path, href) ? "page" : undefined}
              className={clsx("flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors", isActive(path, href) ? "bg-brand/15 text-brand" : "text-fg hover:bg-surface-2")}>
              <Icon className="h-5 w-5" aria-hidden /> {label}
            </Link>
          ))}
        </nav>
        <p className="px-2 text-xs text-muted">Calories and body fat are estimates, not measurements.</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-bg/85 px-4 py-2 backdrop-blur md:px-8">
          <Link href="/" className="flex items-center gap-2 font-semibold md:hidden">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-brand-fg"><Activity className="h-4 w-4" aria-hidden /></span> FitTrack AI
          </Link>
          <div className="hidden md:block" />
          <div className="flex items-center gap-1">
            {(!online || queued > 0) && (
              <span role="status" className="mr-1 inline-flex items-center gap-1 rounded-full bg-warn/15 px-2.5 py-1 text-xs font-medium text-warn">
                <WifiOff className="h-3.5 w-3.5" aria-hidden /> {online ? `${queued} syncing` : "Offline"}
              </span>
            )}
            <NotificationBell />
            <ThemeToggle />
          </div>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 pb-32 pt-5 md:px-8 md:pb-28">{children}</main>
      </div>

      {/* Mobile bottom navigation */}
      <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-surface/95 backdrop-blur md:hidden">
        {BOTTOM.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-current={isActive(path, href) ? "page" : undefined}
            className={clsx("flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium", isActive(path, href) ? "text-brand" : "text-muted")}>
            <Icon className="h-5 w-5" aria-hidden /> {label}
          </Link>
        ))}
      </nav>

      <VoiceSheet />
    </div>
  );
}
