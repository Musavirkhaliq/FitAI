import { describe, expect, it } from "vitest";
import { CATALOG } from "./catalog";
import { levenshtein, normalize, similarity } from "./fuzzy";
import { computeFoodEstimate, needsBoneQuestion, normalizeUnit, toGrams } from "./portion";
import { bestMatches } from "./fuzzy";

const find = (name: string) => {
  const m = bestMatches(name, CATALOG.flatMap((f) => [f.name, ...(f.aliases ?? [])].map((label) => ({ f, label }))), (x) => x.label, 1, 0.5)[0];
  return { food: m.item.f, score: m.score, branded: false };
};

describe("fuzzy matching", () => {
  it("levenshtein distance", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
  });
  it("matches near-spellings and plurals", () => {
    expect(similarity("egg whites", "egg white")).toBeGreaterThan(0.9);
    expect(similarity("masur dal", "masoor dal")).toBeGreaterThan(0.8);
    expect(similarity("banana", "bread")).toBeLessThan(0.6);
  });
  it("normalises filler words", () => {
    expect(normalize("Some of the Rice")).toBe("rice");
  });
  it("resolves everyday foods from the catalog", () => {
    expect(find("egg whites").food.name).toBe("egg white");
    expect(find("diet coke").food.name).toBe("diet coke");
    expect(find("masur dal").food.name).toBe("masoor dal");
    expect(find("mayo").food.name).toBe("mayonnaise");
  });
});

describe("units", () => {
  it("normalises spoken units", () => {
    expect(normalizeUnit("grams")).toBe("g");
    expect(normalizeUnit("Kilos")).toBe("kg");
    expect(normalizeUnit("")).toBe("serving");
  });
  it("converts egg pieces and weights", () => {
    expect(toGrams(5, "pieces", find("egg white").food).grams).toBe(165);
    expect(toGrams(0.3, "kg", find("rice").food).grams).toBe(300);
  });
});

describe("estimates", () => {
  it("five egg whites ≈ 86 kcal and ~18 g protein, HIGH-ish range", () => {
    const e = computeFoodEstimate({ name: "egg whites", quantity: 5, unit: "pieces" }, find("egg whites"));
    expect(e.calories).toBeGreaterThan(80);
    expect(e.calories).toBeLessThan(95);
    expect(e.protein).toBeGreaterThan(17);
  });

  it("bone-in chicken is MEDIUM with oil + yield assumptions, in a sane range", () => {
    const e = computeFoodEstimate({ name: "bone-in chicken", quantity: 400, unit: "g", boneIn: true, prep: "curry" }, find("bone-in chicken"));
    expect(e.estimate.confidence).toBe("MEDIUM");
    expect(e.assumptions.join(" ")).toMatch(/Bone-in/);
    expect(e.calories).toBeGreaterThan(500);
    expect(e.calories).toBeLessThan(800);
    expect(e.estimate.sources.join(" ")).toMatch(/bone-in/);
  });

  it("flags raw/cooked ambiguity for grams of rice, and converts when stated raw", () => {
    const cooked = computeFoodEstimate({ name: "rice", quantity: 300, unit: "g" }, find("rice"));
    expect(cooked.assumptions.join(" ")).toMatch(/cooked weight/);
    expect(cooked.calories).toBeCloseTo(390, -1);
    const raw = computeFoodEstimate({ name: "rice", quantity: 100, unit: "g", state: "RAW" }, find("rice"));
    expect(raw.calories).toBeGreaterThan(330);
  });

  it("biryani is LOW confidence", () => {
    const e = computeFoodEstimate({ name: "biryani", quantity: 1, unit: "plate", restaurant: true }, find("biryani"));
    expect(e.estimate.confidence).toBe("LOW");
    expect(e.estimate.max - e.estimate.min).toBeGreaterThan(e.calories * 0.4);
  });

  it("measured upgrades to HIGH and conservative logs the max", () => {
    const m = computeFoodEstimate({ name: "chicken breast", quantity: 150, unit: "g", measured: true }, find("chicken breast"));
    expect(m.estimate.confidence).toBe("HIGH");
    const c = computeFoodEstimate({ name: "biryani", quantity: 1, unit: "plate" }, find("biryani"), { conservative: true });
    expect(c.calories).toBe(c.estimate.max);
  });

  it("applies the calibration bias", () => {
    const a = computeFoodEstimate({ name: "banana", quantity: 1, unit: "piece" }, find("banana"));
    const b = computeFoodEstimate({ name: "banana", quantity: 1, unit: "piece" }, find("banana"), { bias: 1.1 });
    expect(b.calories).toBeGreaterThan(a.calories);
  });
});

describe("bone-in clarification", () => {
  const chicken = { name: "chicken", quantity: 400, unit: "g" };
  it("asks when unknown and no memory", () => expect(needsBoneQuestion(chicken, null)).toBe(true));
  it("does not ask when memory knows", () => expect(needsBoneQuestion(chicken, true)).toBe(false));
  it("does not ask when the user said", () => expect(needsBoneQuestion({ ...chicken, boneIn: false }, null)).toBe(false));
  it("does not ask for breast, eggs or pieces", () => {
    expect(needsBoneQuestion({ ...chicken, name: "chicken breast" }, null)).toBe(false);
    expect(needsBoneQuestion({ name: "egg", quantity: 2, unit: "pieces" }, null)).toBe(false);
    expect(needsBoneQuestion({ name: "chicken", quantity: 2, unit: "pieces" }, null)).toBe(false);
  });
});
