import ExcelJS from "exceljs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { db } from "@/lib/db";

export type ExportKind = "nutrition" | "weight" | "activity" | "workouts" | "measurements";
export type ExportFormat = "csv" | "xlsx" | "pdf";

export interface Table {
  title: string;
  columns: string[];
  rows: (string | number | null)[][];
}

export async function buildTable(userId: string, kind: ExportKind, from?: string, to?: string): Promise<Table> {
  const range = (from || to) ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {};
  switch (kind) {
    case "nutrition": {
      const r = await db.foodEntry.findMany({ where: { userId, ...range }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
      return {
        title: "Nutrition log (calories are estimates)",
        columns: ["Date", "Meal", "Food", "Quantity", "Unit", "Calories (est.)", "Min", "Max", "Confidence", "Protein g", "Carbs g", "Fat g", "Fiber g", "Notes"],
        rows: r.map((x) => [x.date, x.meal, x.food, x.quantity, x.unit, Math.round(x.calories), Math.round(x.estimateMin), Math.round(x.estimateMax), x.confidence, x.protein, x.carbs, x.fat, x.fiber, x.notes]),
      };
    }
    case "weight": {
      const r = await db.weightEntry.findMany({ where: { userId, ...range }, orderBy: { date: "asc" } });
      return { title: "Weight log", columns: ["Date", "Weight kg", "Time", "Conditions"], rows: r.map((x) => [x.date, x.weightKg, x.time, x.conditions]) };
    }
    case "activity": {
      const [a, s] = await Promise.all([
        db.activityEntry.findMany({ where: { userId, ...range }, orderBy: { date: "asc" } }),
        db.sleepEntry.findMany({ where: { userId, ...range }, orderBy: { date: "asc" } }),
      ]);
      return {
        title: "Activity & sleep",
        columns: ["Date", "Type", "Steps", "Minutes", "Distance km", "Intensity", "Notes"],
        rows: [...a.map((x) => [x.date, x.type, x.steps, x.durationMin, x.distanceKm, x.intensity, x.notes] as (string | number | null)[]), ...s.map((x) => [x.date, "SLEEP", null, Math.round(x.hours * 60), null, null, `${x.hours} h`] as (string | number | null)[])].sort((p, q) => String(p[0]).localeCompare(String(q[0]))),
      };
    }
    case "workouts": {
      const r = await db.workoutSet.findMany({ where: { userId, ...range }, orderBy: [{ date: "asc" }, { createdAt: "asc" }] });
      return { title: "Workout sets", columns: ["Date", "Exercise", "Set", "Reps", "Weight kg", "RPE", "Volume kg", "Est. 1RM"], rows: r.map((x) => [x.date, x.exerciseName, x.setNumber, x.reps, x.weightKg, x.rpe, x.volume, x.est1rm]) };
    }
    case "measurements": {
      const r = await db.bodyMeasurement.findMany({ where: { userId, ...range }, orderBy: { date: "asc" } });
      return { title: "Body measurements (body-fat values are estimates)", columns: ["Date", "Waist cm", "Neck cm", "Hip cm", "Body fat %", "Notes"], rows: r.map((x) => [x.date, x.waistCm, x.neckCm, x.hipCm, x.bodyFatPct, x.notes]) };
    }
  }
}

/** CSV with a leading guard against spreadsheet formula injection (cells starting = + - @). */
export function toCsv(t: Table): string {
  const cell = (v: string | number | null) => {
    if (v == null) return "";
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s) && typeof v === "string") s = "'" + s;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [t.columns, ...t.rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export async function toXlsx(t: Table): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(t.title.slice(0, 31).replace(/[\\/?*[\]:]/g, " "));
  ws.addRow(t.columns).font = { bold: true };
  for (const r of t.rows) ws.addRow(r);
  ws.columns.forEach((c) => (c.width = 16));
  ws.views = [{ state: "frozen", ySplit: 1 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function toPdf(t: Table): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 842, H = 595, M = 36; // A4 landscape
  const colW = (W - 2 * M) / t.columns.length;
  const size = 8;
  const fit = (s: string, w: number) => {
    let out = s;
    while (out.length > 1 && font.widthOfTextAtSize(out, size) > w - 4) out = out.slice(0, -1);
    return out === s ? s : out.slice(0, -1) + "…";
  };
  let page = doc.addPage([W, H]);
  let y = H - M;
  const header = () => {
    page.drawText(t.title, { x: M, y, size: 12, font: bold });
    y -= 18;
    t.columns.forEach((c, i) => page.drawText(fit(c, colW), { x: M + i * colW, y, size, font: bold }));
    y -= 12;
  };
  header();
  for (const row of t.rows) {
    if (y < M + 20) {
      page = doc.addPage([W, H]);
      y = H - M;
      header();
    }
    row.forEach((v, i) => page.drawText(fit(v == null ? "" : String(v).replace(/[^\x20-\x7E]/g, "?"), colW), { x: M + i * colW, y, size, font, color: rgb(0.1, 0.1, 0.1) }));
    y -= 11;
  }
  for (const p of doc.getPages()) p.drawText("AI can make mistakes. Double-check important results. Calorie and body-fat figures are estimates.", { x: M, y: 16, size: 7, font, color: rgb(0.4, 0.4, 0.4) });
  return doc.save();
}
