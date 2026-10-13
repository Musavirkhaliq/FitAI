/**
 * WCAG 2.1 contrast audit of the design tokens in src/app/globals.css (both themes).
 *   node scripts/check-contrast.mjs
 * Reads the CSS variables, composites translucent tints over their surface, and exits 1 if any pair is below 4.5:1 (text)
 * or 3:1 (graphical objects such as rings and chart series).
 */
import fs from "node:fs";

const css = fs.readFileSync("src/app/globals.css", "utf8").split("\r\n").join("\n");

/** Parse "--name: R G B;" triplets inside the first rule whose selector is `sel`. */
function block(sel) {
  const start = css.indexOf(sel + " {");
  if (start < 0) throw new Error("selector not found: " + sel);
  const end = css.indexOf("\n}", start);
  const vars = {};
  for (const m of css.slice(start, end).matchAll(/--([a-z0-9-]+):\s*(\d+)\s+(\d+)\s+(\d+)\s*;/g)) {
    vars[m[1]] = [Number(m[2]), Number(m[3]), Number(m[4])];
  }
  return vars;
}

const light = block(":root");
const dark = { ...light, ...block(".dark") };

const lin = (c) => {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};
/** `fg` at opacity `a` composited over `bg`. */
const over = (fg, bg, a) => fg.map((c, i) => c * a + bg[i] * (1 - a));

let failed = 0;
const rows = [];
function check(theme, label, fg, bg, min) {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) failed++;
  rows.push({ theme, pair: label, ratio: Number(r.toFixed(2)), need: min, result: ok ? "pass" : "FAIL" });
}

for (const [theme, v] of [["light", light], ["dark", dark]]) {
  for (const s of ["bg", "surface", "surface-2", "surface-3"]) {
    check(theme, `fg on ${s}`, v.fg, v[s], 4.5);
    check(theme, `muted on ${s}`, v.muted, v[s], 4.5);
  }
  for (const s of ["bg", "surface", "surface-2"]) check(theme, `brand text on ${s}`, v.brand, v[s], 4.5);
  for (const name of ["good", "warn", "bad"]) {
    check(theme, `${name} text on surface`, v[name], v.surface, 4.5);
    check(theme, `${name} badge (text on 12% tint)`, v[name], over(v[name], v.surface, 0.12), 4.5);
    check(theme, `${name} notice (body text on 10% tint)`, v.fg, over(v[name], v.surface, 0.1), 4.5);
  }
  check(theme, "brand badge (brand on 12% tint)", v.brand, over(v.brand, v.surface, 0.12), 4.5);
  // Primary button: light = solid brand with white text; dark = gradient, so check both end colours with brand-fg.
  if (theme === "light") check(theme, "primary button text on brand", v["brand-fg"], v.brand, 4.5);
  else {
    check(theme, "primary button text on gradient start", v["brand-fg"], [52, 211, 153], 4.5);
    check(theme, "primary button text on gradient end", v["brand-fg"], [34, 211, 238], 4.5);
  }
  // Graphical objects (rings, series) need 3:1 against the surface.
  for (const c of ["c-cal", "c-protein", "c-steps", "c-sleep", "c-fiber"]) check(theme, `${c} ring/series on surface`, v[c], v.surface, 3);
}

console.table(rows);
console.log(failed ? `\n${failed} pair(s) below threshold` : "\nAll token pairs meet WCAG 2.1 AA thresholds.");
process.exit(failed ? 1 : 0);
