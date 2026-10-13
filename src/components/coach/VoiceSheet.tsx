"use client";
import { usePathname } from "next/navigation";
import { Sheet } from "@/components/ui";
import { useCoach } from "./CoachProvider";
import { MessageList, SafetyFooter } from "./Messages";
import { VoiceOrb } from "./VoiceOrb";
import { VoicePanel } from "./VoicePanel";

/** Docked orb on every screen (except those with their own voice surface) + the sheet it opens. */
export function VoiceSheet() {
  const c = useCoach();
  const path = usePathname();
  // Screens with their own voice surface hide the floating orb; everywhere else (incl. Today) it stays one tap away.
  const hideFab = path.startsWith("/coach") || path.startsWith("/workouts/session") || path === "/onboarding";
  const recent = c.messages.slice(-4);
  return (
    <>
      {!hideFab && (
        // Right-hand thumb zone, just above the tab bar. The wrapper ignores pointer events so ripples never block taps.
        <div className="pointer-events-none fixed bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.6rem)] right-1 z-40 md:bottom-4 md:right-4">
          <VoiceOrb
            state={c.voiceState}
            size={58}
            hasError={!!c.voiceError}
            label="Talk to your coach"
            onClick={() => {
              c.openSheet();
              if (c.voiceState === "idle") void c.listen();
            }}
          />
        </div>
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
