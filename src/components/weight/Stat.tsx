import type { ReactNode } from "react";
import { Tile } from "@/components/ui";

/** Small bento tile: eyebrow label, display-font value, one quiet line of context. Shared by weight, progress and dashboard. */
export function Stat({ label, value, sub, index = 0, span = 1, icon, children }: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  index?: number;
  span?: 1 | 2;
  icon?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Tile index={index} span={span} className="!p-3.5 sm:!p-4">
      <p className="eyebrow flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <p className="num mt-2 text-[1.5rem]">{value}</p>
      {sub && <p className="mt-1.5 text-xs leading-snug text-muted">{sub}</p>}
      {children}
    </Tile>
  );
}
