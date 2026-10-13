"use client";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AddMemoryForm } from "@/components/settings/AddMemoryForm";
import { CATEGORIES, MemoryItem } from "@/components/settings/MemoryItem";
import type { MemoryDto } from "@/components/settings/types";
import { EmptyState, ErrorState, LoadingBlock, Notice, PageHeader } from "@/components/ui";
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

  const groups = useMemo(() => {
    const list = data?.memories ?? [];
    return CATEGORIES.map((c) => ({ ...c, items: list.filter((m) => m.category === c.value) })).filter((g) => g.items.length > 0);
  }, [data]);

  if (loading && !data) return <LoadingBlock label="Loading memories" rows={3} />;
  if (!data) return <ErrorState message={error ?? "I couldn't load your memories. Check your connection."} onRetry={() => void refresh()} />;

  const replace = (m: MemoryDto) => setData((prev) => (prev ? { memories: prev.memories.map((x) => (x.id === m.id ? m : x)) } : prev));
  const remove = (id: string) => setData((prev) => (prev ? { memories: prev.memories.filter((x) => x.id !== id) } : prev));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/settings" className="inline-flex min-h-[44px] items-center gap-1 text-sm text-brand underline"><ArrowLeft className="h-4 w-4" aria-hidden /> Back to settings</Link>
      <PageHeader
        title="What your coach remembers"
        subtitle="Your coach uses these notes to personalise its answers. If you've said you usually eat bone-in chicken, it won't keep asking. You can add, correct or delete anything here at any time."
        actions={!adding && <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus className="h-4 w-4" aria-hidden /> Add a memory</button>}
      />
      {error && <Notice tone="warn">{error}</Notice>}

      {adding && <AddMemoryForm onCancel={() => setAdding(false)} onAdded={() => { setAdding(false); void refresh(); }} />}

      {groups.length === 0 ? (
        <EmptyState
          title="Nothing remembered yet"
          body="As you chat, your coach notes useful things. You can also tell it directly, with phrases like:"
          action={
            <ul className="space-y-1 text-left text-sm">
              {EXAMPLES.map((x) => <li key={x}>“{x}”</li>)}
            </ul>
          }
        />
      ) : (
        groups.map((g) => (
          <section key={g.value} className="card" aria-labelledby={`cat-${g.value}`}>
            <h2 id={`cat-${g.value}`} className="text-lg font-semibold">{g.label}</h2>
            <ul className="mt-1 divide-y divide-border">
              {g.items.map((m) => <MemoryItem key={m.id} memory={m} onChanged={replace} onDeleted={remove} />)}
            </ul>
          </section>
        ))
      )}

      <p className="text-xs text-muted">Inferred notes are guesses from your conversations, so correct any that are wrong. Memories are only used to help your coach, never as medical advice.</p>
    </div>
  );
}
