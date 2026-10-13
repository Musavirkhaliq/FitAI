/** Subset of GET /api/workouts used by the Progress page. */
export interface StrengthSeriesDto {
  exercise: string;
  points: { date: string; est1rm: number }[];
}

export interface PrDto {
  id: string;
  date: string;
  title: string;
  data: Record<string, unknown> | null;
}

export type VolumeStatus = "BELOW_MEV" | "PRODUCTIVE" | "NEAR_MRV" | "OVER_MRV";

export interface VolumeDto {
  muscle: string;
  hardSets: number;
  status: VolumeStatus;
  mev: number;
  mrv: number;
}

export interface WorkoutsDto {
  strength: StrengthSeriesDto[];
  prs: PrDto[];
  volume: VolumeDto[];
  sessions: { id: string; date: string; status: string }[];
}
