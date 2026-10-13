import { describe, expect, it } from "vitest";
import { addDays } from "../dates";
import { summarizeTrend, type WeightPoint } from "./weightTrend";
import { adviseCalories, bmr, clampToFloor, startingTargets } from "./calories";
import { buildEstimate, calibrate, confidenceFor, rangePct, upgradeToMeasured } from "./estimation";
import { checkRapidLoss, classifyMessage, validateCalorieTarget } from "./safety";
import { prescribeNext, robust1RM, volumeStatus } from "./overload";
import { navyBodyFat } from "./bodycomp";
import { consistencyScore, forgivingStreak } from "./habits";

const END = "2026-03-30";
/** Linear weights ending at `end`, one per day for n days, losing `perWeek` kg a week. */
function series(n: number, startKg: number, perWeek: number, noise = 0): WeightPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    date: addDays(END, -(n - 1 - i)),
    weightKg: startKg + (perWeek / 7) * i + (i % 2 ? noise : -noise),
  }));
}

describe("weight trend", () => {
  it("won't classify on a handful of weigh-ins", () => {
    const t = summarizeTrend(series(3, 85, -0.5), END);
    expect(t.status).toBe("INSUFFICIENT_DATA");
  });

  it("detects a healthy target loss", () => {
    const t = summarizeTrend(series(21, 85, -0.5), END);
    expect(t.status).toBe("TARGET_LOSS");
    expect(t.weeklyRateKg).toBeCloseTo(-0.5, 1);
  });

  it("detects plateau, slow loss, gain and fast loss", () => {
    expect(summarizeTrend(series(21, 85, 0.0), END).status).toBe("PLATEAU");
    expect(summarizeTrend(series(21, 85, -0.18), END).status).toBe("SLOW_LOSS");
    expect(summarizeTrend(series(21, 85, 0.4), END).status).toBe("GAINING");
    expect(summarizeTrend(series(21, 85, -1.2), END).status).toBe("FAST_LOSS");
  });

  it("is not thrown by one odd weigh-in", () => {
    const pts = series(21, 85, -0.5);
    pts[pts.length - 1].weightKg += 1.8; // salty dinner
    const t = summarizeTrend(pts, END);
    expect(["TARGET_LOSS", "SLOW_LOSS"]).toContain(t.status);
  });

  it("flags sustained fast loss only after two fast weeks", () => {
    expect(summarizeTrend(series(21, 90, -1.3), END).sustainedFastLoss).toBe(true);
    expect(summarizeTrend(series(21, 90, -0.5), END).sustainedFastLoss).toBe(false);
  });

  it("reports change from yesterday and start", () => {
    const t = summarizeTrend(series(21, 85, -0.5), END, 86);
    expect(t.changeFromYesterdayKg).toBeLessThan(0);
    expect(t.changeFromStartKg).toBeLessThan(-1);
  });
});

describe("calories", () => {
  it("never goes under the floor", () => {
    expect(clampToFloor(1100, "FEMALE")).toEqual({ kcal: 1200, clamped: true });
    expect(clampToFloor(1400, "MALE")).toEqual({ kcal: 1500, clamped: true });
    expect(clampToFloor(1700, "MALE").clamped).toBe(false);
  });

  it("starting targets respect the floor and are not hard-coded", () => {
    const a = startingTargets({ sex: "FEMALE", weightKg: 48, heightCm: 155, ageYears: 40, activityMultiplier: 1.2, goal: "FAT_LOSS", targetRateKgPerWeek: 1 });
    expect(a.calories).toBeGreaterThanOrEqual(1200);
    const b = startingTargets({ sex: "MALE", weightKg: 90, heightCm: 180, ageYears: 30, activityMultiplier: 1.4, goal: "FAT_LOSS" });
    expect(b.calories).toBeGreaterThan(a.calories);
    expect(b.proteinG).toBe(180);
    expect(bmr("MALE", 90, 180, 30)).toBe(1880);
  });

  it("waits for 14 days, then follows the rules", () => {
    const early = adviseCalories({ trend: summarizeTrend(series(5, 85, -0.1), END), currentTarget: 2000, sex: "MALE", adherence: 1 });
    expect(early.action).toBe("WAIT");

    const slow = adviseCalories({ trend: summarizeTrend(series(21, 85, -0.15), END), currentTarget: 2000, sex: "MALE", adherence: 0.9 });
    expect(slow.action).toBe("DECREASE");
    expect(slow.deltaKcal).toBeGreaterThanOrEqual(-150);
    expect(slow.deltaKcal).toBeLessThanOrEqual(-100);

    const good = adviseCalories({ trend: summarizeTrend(series(21, 85, -0.6), END), currentTarget: 2000, sex: "MALE", adherence: 0.9 });
    expect(good.action).toBe("KEEP");

    const fast = adviseCalories({ trend: summarizeTrend(series(21, 90, -1.3), END), currentTarget: 2000, sex: "MALE", adherence: 0.9 });
    expect(fast.action).toBe("INCREASE");
  });

  it("won't suggest a cut below the floor", () => {
    const r = adviseCalories({ trend: summarizeTrend(series(21, 85, -0.15), END), currentTarget: 1500, sex: "MALE", adherence: 0.9 });
    expect(r.suggestedTarget).toBe(1500);
    expect(r.blockedByFloor).toBe(true);
  });

  it("ignores trend when logging is poor", () => {
    const r = adviseCalories({ trend: summarizeTrend(series(21, 85, -0.1), END), currentTarget: 2000, sex: "MALE", adherence: 0.3 });
    expect(r.action).toBe("WAIT");
  });
});

describe("estimation", () => {
  it("scales the range with confidence", () => {
    expect(rangePct("HIGH", 0)).toBe(0.1);
    expect(rangePct("MEDIUM", 1)).toBeGreaterThanOrEqual(0.15);
    expect(rangePct("MEDIUM", 9)).toBe(0.25);
    expect(rangePct("LOW", 1)).toBeGreaterThanOrEqual(0.25);
    expect(rangePct("LOW", 9)).toBe(0.4);
  });

  it("rates bone-in chicken with oil as MEDIUM and names the uncertainty", () => {
    const e = buildEstimate(675, { boneIn: true, unmeasuredOil: true });
    expect(e.confidence).toBe("MEDIUM");
    expect(e.sources.join(" ")).toMatch(/bone-in/);
    expect(e.min).toBeLessThan(675);
    expect(e.max).toBeGreaterThan(675);
  });

  it("rates barcode items HIGH and unknown mixed dishes LOW", () => {
    expect(confidenceFor({ barcodeOrMeasured: true })).toBe("HIGH");
    expect(confidenceFor({ mixedDish: true, unknownRecipe: true })).toBe("LOW");
  });

  it("'log on the higher side' uses the max; 'I measured it' upgrades to HIGH", () => {
    const e = buildEstimate(600, { restaurant: true }, { conservative: true });
    expect(e.kcal).toBe(e.max);
    expect(upgradeToMeasured(buildEstimate(600, { restaurant: true })).confidence).toBe("HIGH");
  });

  it("calibration nudges slowly and only with dense logs", () => {
    const sparse = calibrate({ avgLoggedKcal: 1800, daysLogged: 4, windowDays: 14, tdeeEstimate: 2400, observedChangeKg: 0, currentBias: 1 });
    expect(sparse.changed).toBe(false);
    const under = calibrate({ avgLoggedKcal: 1800, daysLogged: 13, windowDays: 14, tdeeEstimate: 2400, observedChangeKg: 0, currentBias: 1 });
    expect(under.changed).toBe(true);
    expect(under.bias).toBeGreaterThan(1);
    expect(under.bias).toBeLessThanOrEqual(1.15);
  });
});

describe("safety", () => {
  it("is GREEN for normal talk, including food and gym language", () => {
    expect(classifyMessage("I had biryani and went to the gym, no pain at all").level).toBe("GREEN");
    expect(classifyMessage("I had 400g chicken for lunch").level).toBe("GREEN");
  });

  it("YELLOW for pain, dizziness, injury", () => {
    expect(classifyMessage("my knee hurts when I squat").level).toBe("YELLOW");
    expect(classifyMessage("felt dizzy after training").level).toBe("YELLOW");
    expect(classifyMessage("I pulled a muscle in my back").level).toBe("YELLOW");
  });

  it("RED for chest pain, fainting, ED behaviour — and blocks logging", () => {
    for (const msg of [
      "I had chest pain on the treadmill",
      "I fainted at the gym",
      "I've been making myself throw up after dinner",
      "I haven't eaten for 4 days",
      "I lost 5 kg in a week",
    ]) {
      const v = classifyMessage(msg);
      expect(v.level, msg).toBe("RED");
      expect(v.allowLogging).toBe(false);
    }
  });

  it("respects negation", () => {
    expect(classifyMessage("no chest pain, just tired legs").level).toBe("GREEN");
  });

  it("enforces the calorie floor on requested goals", () => {
    const v = validateCalorieTarget(1000, "FEMALE");
    expect(v.ok).toBe(false);
    expect(v.calories).toBe(1200);
    expect(validateCalorieTarget(1900, "MALE").ok).toBe(true);
  });

  it("escalates sustained rapid loss", () => {
    expect(checkRapidLoss(summarizeTrend(series(21, 90, -1.3), END))?.level).toBe("RED");
    expect(checkRapidLoss(summarizeTrend(series(21, 90, -0.5), END))).toBeNull();
  });
});

describe("progressive overload", () => {
  const base = { repMin: 8, repMax: 10, numSets: 3, targetRpe: 8 };

  it("adds reps first", () => {
    const p = prescribeNext({ ...base, lastSession: [{ weightKg: 60, reps: 8 }, { weightKg: 60, reps: 8 }, { weightKg: 60, reps: 7 }] });
    expect(p.weightKg).toBe(60);
    expect(p.targetReps).toEqual([9, 9, 8]);
  });

  it("adds weight once every set hits the top", () => {
    const p = prescribeNext({ ...base, lastSession: [10, 10, 10].map((reps) => ({ weightKg: 60, reps, rpe: 8 })) });
    expect(p.weightKg).toBe(62.5);
    expect(p.targetReps).toEqual([8, 8, 8]);
  });

  it("never jumps more than 10%", () => {
    const p = prescribeNext({ ...base, incrementKg: 5, lastSession: [10, 10, 10].map((reps) => ({ weightKg: 20, reps, rpe: 8 })) });
    expect(p.weightKg!).toBeLessThanOrEqual(22);
  });

  it("eases back 10% after two missed sessions", () => {
    const p = prescribeNext({ ...base, missedInRow: 2, lastSession: [{ weightKg: 100, reps: 8 }] });
    expect(p.weightKg).toBe(90);
  });

  it("deloads after RPE 9+ twice or three hard weeks", () => {
    const last = [{ weightKg: 100, reps: 8, rpe: 9.5 }];
    expect(prescribeNext({ ...base, lastSession: last, recentTopRpe: [9.5, 9] }).deload).toBe(true);
    expect(prescribeNext({ ...base, lastSession: last, hardWeeks: 3 }).deload).toBe(true);
    expect(prescribeNext({ ...base, lastSession: last, recentTopRpe: [9.5, 8] }).deload).toBe(false);
  });

  it("estimates 1RM robustly", () => {
    const e = robust1RM([{ weightKg: 100, reps: 5 }, { weightKg: 100, reps: 5 }, { weightKg: 60, reps: 30 }]);
    expect(e).toBeGreaterThan(110);
    expect(e).toBeLessThan(120);
    expect(robust1RM([{ weightKg: 50, reps: 20 }])).toBeNull();
  });

  it("classifies volume against MEV/MRV", () => {
    expect(volumeStatus("chest", 4).status).toBe("BELOW_MEV");
    expect(volumeStatus("chest", 12).status).toBe("PRODUCTIVE");
    expect(volumeStatus("chest", 21).status).toBe("NEAR_MRV");
    expect(volumeStatus("chest", 30).status).toBe("OVER_MRV");
  });
});

describe("body composition & habits", () => {
  it("returns a range, not a point, and needs hips for women", () => {
    const m = navyBodyFat({ sex: "MALE", heightCm: 178, waistCm: 90, neckCm: 38, weightKg: 85 })!;
    expect(m.high).toBeGreaterThan(m.low);
    expect(m.mid).toBeGreaterThan(10);
    expect(m.mid).toBeLessThan(30);
    expect(navyBodyFat({ sex: "FEMALE", heightCm: 165, waistCm: 80, neckCm: 32, weightKg: 65 })).toBeNull();
  });

  it("scores consistency without zeroing on a miss, and forgives one miss in a streak", () => {
    const good = { weighedIn: true, caloriesInRange: true, proteinHit: true, stepsHit: true, slept: true, trained: null, loggedFood: true };
    const days = [{ date: "a", ...good }, { date: "b", ...good, weighedIn: false }];
    expect(consistencyScore(days)).toBeGreaterThan(85);
    expect(forgivingStreak([true, true, false, true, true, false, false], (x) => x)).toBe(4);
  });
});
