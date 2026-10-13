import { describe, expect, it } from "vitest";
import { microReferences, microStatus, sumMicros } from "./micros";
import { sniffImage } from "../../server/photos";

describe("micronutrient totals", () => {
  it("sums per-entry micros and sodium, ignoring missing or junk values", () => {
    const t = sumMicros([
      { sodium: 120, micros: { calcium: 50, iron: 1.2, vitC: 8 } },
      { sodium: 300, micros: { calcium: 121, iron: 0.4, vitB12: 0.37, folate: "20" } },
      { sodium: 0, micros: null },
      { sodium: 10, micros: { calcium: "n/a", vitD: NaN } },
    ]);
    expect(t.calcium).toBe(171);
    expect(t.iron).toBe(1.6);
    expect(t.sodium).toBe(430);
    expect(t.folate).toBe(20);
    expect(t.vitD).toBe(0);
  });

  it("returns zeros for an empty day", () => {
    expect(Object.values(sumMicros([])).every((v) => v === 0)).toBe(true);
  });

  it("gives sex-appropriate references and treats sodium as a limit", () => {
    const f = microReferences("FEMALE");
    const m = microReferences("MALE");
    expect(f.find((r) => r.key === "iron")!.target).toBeGreaterThan(m.find((r) => r.key === "iron")!.target);
    const sodium = m.find((r) => r.key === "sodium")!;
    expect(sodium.kind).toBe("limit");
    expect(microStatus(sodium, 2000)).toBe("OK");
    expect(microStatus(sodium, 3000)).toBe("HIGH");
    const calcium = m.find((r) => r.key === "calcium")!;
    expect(microStatus(calcium, 200)).toBe("LOW");
    expect(microStatus(calcium, 700)).toBe("OK");
  });
});

describe("image sniffing for progress photos", () => {
  const pad = (bytes: number[]) => Uint8Array.from([...bytes, ...Array(16).fill(0)]);
  it("recognises JPEG, PNG and WebP by magic bytes", () => {
    expect(sniffImage(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImage(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    const webp = new TextEncoder().encode("RIFF1234WEBPVP8 ");
    expect(sniffImage(webp)).toBe("image/webp");
  });
  it("rejects scripts, SVG, HTML and tiny files regardless of what the client claims", () => {
    expect(sniffImage(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("<html><body>hi</body></html>"))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("GIF89a......."))).toBeNull();
    expect(sniffImage(Uint8Array.from([0xff, 0xd8]))).toBeNull();
  });
});
