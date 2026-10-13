"use client";
import { Trash2 } from "lucide-react";
import { useCoach } from "@/components/coach/CoachProvider";
import { MessageList, SafetyFooter } from "@/components/coach/Messages";
import { VoicePanel } from "@/components/coach/VoicePanel";
import { PageHeader } from "@/components/ui";

const EXAMPLES = [
  "I weighed 84.5 this morning",
  "I had five egg whites and half a yolk for breakfast",
  "Can I eat biryani tonight?",
  "How am I doing this week?",
  "Why did my weight go up?",
  "Give me tomorrow's workout",
];

export default function CoachPage() {
  const c = useCoach();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader
        title="AI Coach"
        subtitle="Talk or type. I log it, estimate honestly, and say what's a fact, an estimate, an assumption or a recommendation."
        actions={c.messages.length > 0 ? <button className="btn" onClick={() => void c.clearChat()}><Trash2 className="h-4 w-4" aria-hidden /> Clear chat</button> : undefined}
      />
      <div className="card min-h-[40vh]">
        <MessageList
          messages={c.messages}
          empty={
            <div className="space-y-3 py-6 text-center">
              <p className="font-medium">Try saying…</p>
              <div className="flex flex-wrap justify-center gap-2">
                {EXAMPLES.map((e) => (
                  <button key={e} className="btn !min-h-[40px]" onClick={() => void c.send(e, "TEXT")}>{e}</button>
                ))}
              </div>
            </div>
          }
        />
      </div>
      <div className="card"><VoicePanel variant="hero" autoFocusText={false} /></div>
      <SafetyFooter className="text-center" />
    </div>
  );
}
