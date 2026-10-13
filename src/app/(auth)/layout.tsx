import { Activity } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <div className="mb-6 flex items-center gap-2 text-xl font-semibold">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-brand-fg"><Activity className="h-6 w-6" aria-hidden /></span>
        FitTrack AI
      </div>
      <main id="main" className="w-full max-w-sm">{children}</main>
      <p className="mt-6 max-w-sm text-center text-xs text-muted">
        FitTrack AI is a fitness and nutrition coaching tool, not a medical service. AI can make mistakes. Double-check important results.
      </p>
    </div>
  );
}
