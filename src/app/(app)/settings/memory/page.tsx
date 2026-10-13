"use client";
import { ArrowLeft, Brain, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { AddMemoryForm } from "@/components/settings/AddMemoryForm";
import { IconTile } from "@/components/settings/common";
import { CATEGORIES, CATEGORY_META, MemoryItem } from "@/components/settings/MemoryItem";
import type { MemoryDto } from "@/components/settings/types";
import { clsx, EmptyState, ErrorState, LoadingBlock, Notice, PageHeader, Sheet } from "@/components/ui";
import { useApi } from "@/lib/client/api";

const EXAMPLES = [
  "I usually eat bone-in chicken.",
  "I train best in the morning before work.",
  "Remember that I'm travelling next month.",
  "I don't like eating after 8 pm.",
];

export default function MemoryPage() {
  const { data, error, loading, refresh, setData } = useApi<{ memories: MemoryDto[] }>("/api/memory");
  const [adding, setAdding] = useState(false);
  const closeAdd = useCallback(() => setAdding(false), []);

  const groups = useMemo(() => {
    const list = data?.memories ?? [];
    return CATEGORIES.map((c) => ({ ...c, items: list.filter((m) => m.category === c.value) })).filter((g) => g.items.length > 0);
  }, [data]);

  if (loading && !data) return <LoadingBlock label="Loading memories" rows={3} />;
  if (!data) return <ErrorState message={error ?? "I couldn't load your memories. Check your connection."} onRetry={() => void refresh()} />;

  const replace = (m: MemoryDto) => setData((prev) => (prev ? { memories: prev.memories.map((x) => (x.id === m.id ? m : x)) } : prev));
  const remove = (id: string) => setData((prev) => (prev ? { memories: prev.memories.filter((x) => x.id !== id) } : prev));

  const addButton = (
    <button className="btn btn-primary" onClick={() => setAdding(true)} aria-haspopup="dialog"><Plus className="h-4 w-4" aria-hidden /> Add a memory</button>
  );

  return (
    <>
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/settings" className="chip"><ArrowLeft className="h-4 w-4" aria-hidden /> Back to settings</Link>
      </div>
      <PageHeader
        title="What your coach remembers"
        subtitle="Your coach uses these notes to personalise its answers. If you've said you usually eat bone-in chicken, it won't keep asking. You can add, correct or delete anything here at any time."
        actions={groups.length > 0 ? addButton : undefined}
      />
      {error && <Notice tone="warn">{error}</Notice>}

      {groups.length === 0 ? (
        <EmptyState
          icon={<Brain className="h-7 w-7" />}
          title="Nothing remembered yet"
          body="As you chat, your coach notes useful things. You can also tell it directly, with phrases like:"
          action={
            <div className="flex flex-col items-center gap-4">
              <ul className="flex flex-wrap justify-center gap-2 text-left text-sm">
                {EXAMPLES.map((x) => <li key={x} className="rounded-2xl bg-surface-2 px-3.5 py-2 italic">“{x}”</li>)}
              </ul>
              {addButton}
            </div>
          }
        />
      ) : (
        groups.map((g, i) => {
          const meta = CATEGORY_META[g.value];
          return (
            <section key={g.value} className="rise" aria-labelledby={`cat-${g.value}`} style={{ ["--i" as string]: Math.min(i, 6) }}>
              <h2 id={`cat-${g.value}`} className={clsx("mb-3 flex items-center gap-2.5 rounded-2xl px-3 py-2 text-base font-extrabold display", meta.head)}>
                <IconTile icon={meta.icon} tint={meta.tint} />
                {g.label}
                <span className="ml-auto text-xs font-semibold text-muted"><span className="sr-only">{g.items.length} notes</span><span aria-hidden>{g.items.length}</span></span>
              </h2>
              <ul className="space-y-3">
                {g.items.map((m) => <MemoryItem key={m.id} memory={m} onChanged={replace} onDeleted={remove} />)}
              </ul>
            </section>
          );
        })
      )}

      <p className="px-1 text-xs leading-relaxed text-muted">Inferred notes are guesses from your conversations, so correct any that are wrong. Memories are only used to help your coach, never as medical advice.</p>

    </div>

    <Sheet open={adding} onClose={closeAdd} title="Add a memory">
      <AddMemoryForm onCancel={closeAdd} onAdded={() => { setAdding(false); void refresh(); }} />
    </Sheet>
    </>
  );
}
