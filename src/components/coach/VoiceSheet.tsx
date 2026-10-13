"use client";
import { Mic } from "lucide-react";
import { usePathname } from "next/navigation";
import { Sheet } from "@/components/ui";
import { useCoach } from "./CoachProvider";
import { MessageList, SafetyFooter } from "./Messages";
import { VoicePanel } from "./VoicePanel";

/** Floating mic on every screen (except those with their own voice surface) + the sheet it opens. */
export function VoiceSheet() {
  const c = useCoach();
  const path = usePathname();
  // Screens with their own voice surface hide the floating mic; everywhere else (incl. Today) it stays one tap away.
  const hideFab = path.startsWith("/coach") || path.startsWith("/workouts/session");
  const recent = c.messages.slice(-4);
  return (
    <>
      {!hideFab && (
        <button
          onClick={() => {
            c.openSheet();
            if (c.voiceState === "idle") void c.listen();
          }}
          aria-label="Talk to your coach"
          className="fixed bottom-[4.75rem] right-4 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-brand text-brand-fg shadow-lg shadow-brand/30 transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:right-6"
        >
          <Mic className="h-7 w-7" aria-hidden />
        </button>
      )}
      <Sheet open={c.sheetOpen} onClose={c.closeSheet} title="Talk to your coach">
        <div className="space-y-4">
          {recent.length > 0 && <div className="max-h-48 overflow-y-auto"><MessageList messages={recent} compact /></div>}
          <VoicePanel variant="compact" />
          <SafetyFooter />
        </div>
      </Sheet>
    </>
  );
}
