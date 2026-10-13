/**
 * Seeds the shared food catalog (user_id = null) into `food_items` so server-side lookups, joins and
 * analytics see the same foods the in-memory catalog uses. Idempotent: re-running updates rows in place.
 *   npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { CATALOG } from "../src/lib/food/catalog";
import { normalize } from "../src/lib/food/fuzzy";

const db = new PrismaClient();

async function main() {
  let created = 0;
  let updated = 0;
  for (const f of CATALOG) {
    const nameNorm = normalize(f.name);
    const data = {
      name: f.name, nameNorm, source: "LOCAL", state: f.state, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, fiber: f.fiber,
      sodium: f.sodium, calcium: f.calcium, iron: f.iron, potassium: f.potassium, vitA: f.vitA, vitC: f.vitC, vitD: f.vitD, vitB12: f.vitB12,
      folate: f.folate, edibleFraction: f.edibleFraction, unitGrams: f.unitGrams,
    };
    const existing = await db.foodItem.findFirst({ where: { userId: null, source: "LOCAL", nameNorm } });
    if (existing) {
      await db.foodItem.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await db.foodItem.create({ data: { ...data, userId: null } });
      created++;
    }
  }
  console.log(`Food catalog seeded: ${created} created, ${updated} updated.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
