import type { Goal, UserProfile } from "@prisma/client";
import { db } from "@/lib/db";
import { todayIn } from "@/lib/dates";

export interface UserContext {
  userId: string;
  profile: UserProfile;
  goal: Goal | null;
  tz: string;
  today: string;
  ageYears: number | null;
}

/** Load profile (creating an empty one on first use) and the active goal. */
export async function loadUserContext(userId: string): Promise<UserContext> {
  const profile = await db.userProfile.upsert({ where: { userId }, update: {}, create: { userId } });
  const goal = await db.goal.findFirst({ where: { userId, active: true }, orderBy: { createdAt: "desc" } });
  const tz = profile.timezone || "UTC";
  const year = new Date().getUTCFullYear();
  return {
    userId,
    profile,
    goal,
    tz,
    today: todayIn(tz),
    ageYears: profile.birthYear ? year - profile.birthYear : null,
  };
}
