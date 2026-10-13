import type { FoodRecord, FoodRole, FoodState } from "./types";

/**
 * Local, offline-capable catalog of everyday foods, values per 100 g (typical USDA / IFCT figures,
 * rounded). It is the first stop for lookups, the fallback when USDA/OFF are unreachable, and the seed
 * for the shared `food_items` table. Packaged goods vary by brand — barcode lookup is more accurate.
 */
interface Row {
  n: string; // name
  a?: string[]; // aliases
  st: FoodState;
  r: FoodRole;
  k: number; // kcal
  p: number; // protein g
  c: number; // carbs g
  f: number; // fat g
  fi?: number; // fiber g
  na?: number; // sodium mg
  ca?: number; // calcium mg
  fe?: number; // iron mg
  kp?: number; // potassium mg
  va?: number; // vit A µg RAE
  vc?: number; // vit C mg
  vd?: number; // vit D µg
  b12?: number; // vit B12 µg
  fol?: number; // folate µg
  edible?: number;
  u?: Record<string, number>; // unit grams
  mixed?: boolean;
}

const ROWS: Row[] = [
  // --- Eggs & dairy ---
  { n: "egg", a: ["eggs", "whole egg", "boiled egg", "egg whole"], st: "COOKED", r: "protein", k: 155, p: 12.6, c: 1.1, f: 10.6, na: 124, ca: 50, fe: 1.2, kp: 126, va: 160, vd: 2.2, b12: 1.1, fol: 44, u: { piece: 50, egg: 50 } },
  { n: "egg white", a: ["egg whites", "white of egg"], st: "COOKED", r: "protein", k: 52, p: 10.9, c: 0.7, f: 0.2, na: 166, ca: 7, fe: 0.1, kp: 163, b12: 0.1, fol: 4, u: { piece: 33, egg: 33 } },
  { n: "egg yolk", a: ["egg yolks", "yolk", "yolks"], st: "COOKED", r: "fat", k: 322, p: 15.9, c: 3.6, f: 26.5, ca: 129, fe: 2.7, kp: 109, va: 381, vd: 5.4, b12: 1.95, fol: 146, u: { piece: 17, yolk: 17 } },
  { n: "curd", a: ["dahi", "yogurt", "yoghurt", "plain curd", "plain yogurt"], st: "PACKAGED", r: "dairy", k: 61, p: 3.5, c: 4.7, f: 3.3, na: 46, ca: 121, kp: 155, b12: 0.4, va: 27, u: { bowl: 200, cup: 245, tbsp: 15 } },
  { n: "greek yogurt", a: ["greek yoghurt", "hung curd", "hung dahi"], st: "PACKAGED", r: "dairy", k: 59, p: 10, c: 3.6, f: 0.4, na: 36, ca: 110, kp: 141, b12: 0.5, u: { bowl: 200, cup: 245 } },
  { n: "milk", a: ["whole milk", "full cream milk"], st: "PACKAGED", r: "dairy", k: 61, p: 3.2, c: 4.8, f: 3.3, na: 43, ca: 113, kp: 132, va: 46, vd: 1.3, b12: 0.45, fol: 5, u: { cup: 244, glass: 250 } },
  { n: "skim milk", a: ["toned milk", "low fat milk"], st: "PACKAGED", r: "dairy", k: 34, p: 3.4, c: 5, f: 0.1, na: 42, ca: 125, kp: 156, vd: 1.2, b12: 0.5, u: { cup: 245, glass: 250 } },
  { n: "paneer", a: ["cottage cheese indian"], st: "PACKAGED", r: "protein", k: 300, p: 18, c: 3, f: 23, na: 22, ca: 480, fe: 0.2, kp: 100, va: 190, b12: 0.8, u: { cube: 10, piece: 25 } },
  { n: "cheese", a: ["cheddar", "cheese slice", "processed cheese"], st: "PACKAGED", r: "fat", k: 404, p: 25, c: 1.3, f: 33, na: 621, ca: 720, fe: 0.7, kp: 98, va: 265, b12: 1.1, u: { slice: 20 } },
  { n: "whey protein", a: ["whey", "protein powder", "protein shake powder"], st: "PACKAGED", r: "protein", k: 400, p: 80, c: 8, f: 6, na: 200, ca: 400, u: { scoop: 30 } },

  // --- Meat, fish ---
  { n: "chicken breast", a: ["boneless chicken", "boneless chicken breast", "grilled chicken", "chicken boneless", "chicken"], st: "COOKED", r: "protein", k: 165, p: 31, c: 0, f: 3.6, na: 74, ca: 15, fe: 1, kp: 256, b12: 0.3, fol: 4, u: { piece: 120 } },
  { n: "chicken breast raw", a: ["raw chicken breast", "raw chicken", "raw boneless chicken"], st: "RAW", r: "protein", k: 120, p: 22.5, c: 0, f: 2.6, na: 45, ca: 5, fe: 0.4, kp: 334, b12: 0.3, u: { piece: 170 } },
  { n: "chicken bone-in", a: ["bone in chicken", "bone-in chicken", "chicken with bone", "chicken curry bone in", "chicken pieces", "chicken leg", "chicken drumstick", "chicken thigh bone in"], st: "COOKED", r: "protein", k: 215, p: 27, c: 0, f: 11.5, na: 85, ca: 12, fe: 1.1, kp: 230, b12: 0.3, edible: 0.6, u: { piece: 90 } },
  { n: "chicken thigh", a: ["boneless chicken thigh", "chicken thighs boneless"], st: "COOKED", r: "protein", k: 209, p: 26, c: 0, f: 10.9, na: 95, ca: 11, fe: 1.3, kp: 240, b12: 0.4, u: { piece: 100 } },
  { n: "mutton", a: ["lamb", "goat meat", "mutton curry boneless"], st: "COOKED", r: "protein", k: 258, p: 25.6, c: 0, f: 16.5, na: 72, ca: 17, fe: 1.9, kp: 310, b12: 2.6, u: { piece: 40 } },
  { n: "fish", a: ["fish fillet", "white fish", "tilapia", "basa", "cooked fish"], st: "COOKED", r: "protein", k: 128, p: 26, c: 0, f: 2.7, na: 52, ca: 14, fe: 0.7, kp: 380, vd: 4, b12: 1.9, fol: 24, u: { piece: 120 } },
  { n: "salmon", a: ["salmon fillet", "grilled salmon"], st: "COOKED", r: "protein", k: 206, p: 22, c: 0, f: 12, na: 61, ca: 9, fe: 0.3, kp: 384, vd: 11, b12: 3.2, fol: 26, u: { piece: 150 } },
  { n: "tuna", a: ["canned tuna", "tuna in water"], st: "PACKAGED", r: "protein", k: 116, p: 25.5, c: 0, f: 0.8, na: 247, ca: 11, fe: 1.3, kp: 237, vd: 1.7, b12: 2.5, u: { can: 140 } },
  { n: "prawns", a: ["shrimp", "prawn"], st: "COOKED", r: "protein", k: 99, p: 24, c: 0.2, f: 0.3, na: 111, ca: 70, fe: 0.5, kp: 259, b12: 1.1, u: { piece: 8 } },

  // --- Grains & starches ---
  { n: "rice", a: ["white rice", "cooked rice", "steamed rice", "plain rice", "basmati rice cooked"], st: "COOKED", r: "carb", k: 130, p: 2.7, c: 28.2, f: 0.3, fi: 0.4, na: 1, ca: 10, fe: 0.2, kp: 35, fol: 3, u: { cup: 158, bowl: 200, plate: 250, katori: 150 } },
  { n: "rice raw", a: ["raw rice", "uncooked rice", "dry rice", "basmati rice raw"], st: "RAW", r: "carb", k: 365, p: 7.1, c: 80, f: 0.7, fi: 1.3, na: 5, ca: 28, fe: 0.8, kp: 115, fol: 8, u: { cup: 185 } },
  { n: "brown rice", a: ["cooked brown rice"], st: "COOKED", r: "carb", k: 123, p: 2.7, c: 25.6, f: 1, fi: 1.6, na: 4, ca: 3, fe: 0.6, kp: 86, fol: 4, u: { cup: 195, bowl: 200 } },
  { n: "roti", a: ["chapati", "chapatti", "phulka", "wheat roti", "fulka"], st: "COOKED", r: "carb", k: 297, p: 9.7, c: 49, f: 7.5, fi: 4.9, na: 300, ca: 25, fe: 2.5, kp: 190, fol: 25, u: { piece: 40, roti: 40 } },
  { n: "paratha", a: ["plain paratha", "aloo paratha"], st: "COOKED", r: "carb", k: 326, p: 7, c: 45, f: 13, fi: 3, na: 350, ca: 25, fe: 2, u: { piece: 80 } },
  { n: "bread", a: ["white bread", "bread slice", "toast"], st: "PACKAGED", r: "carb", k: 265, p: 9, c: 49, f: 3.2, fi: 2.7, na: 491, ca: 144, fe: 3.6, kp: 115, fol: 111, u: { slice: 30 } },
  { n: "whole wheat bread", a: ["brown bread", "wholemeal bread", "multigrain bread"], st: "PACKAGED", r: "carb", k: 252, p: 12.3, c: 42.7, f: 3.5, fi: 6, na: 450, ca: 161, fe: 2.4, kp: 250, fol: 44, u: { slice: 30 } },
  { n: "oats", a: ["rolled oats", "oatmeal dry", "dry oats"], st: "RAW", r: "carb", k: 389, p: 16.9, c: 66.3, f: 6.9, fi: 10.6, na: 2, ca: 54, fe: 4.7, kp: 429, fol: 56, u: { cup: 80, tbsp: 7 } },
  { n: "pasta", a: ["cooked pasta", "spaghetti", "macaroni", "noodles cooked"], st: "COOKED", r: "carb", k: 158, p: 5.8, c: 30.9, f: 0.9, fi: 1.8, na: 1, ca: 7, fe: 1.3, kp: 44, fol: 7, u: { cup: 140, bowl: 220, plate: 280 } },
  { n: "potato", a: ["boiled potato", "potatoes"], st: "COOKED", r: "carb", k: 87, p: 1.9, c: 20.1, f: 0.1, fi: 1.8, na: 4, ca: 5, fe: 0.3, kp: 379, vc: 13, fol: 9, u: { piece: 150 } },
  { n: "sweet potato", a: ["baked sweet potato", "shakarkandi"], st: "COOKED", r: "carb", k: 90, p: 2, c: 20.7, f: 0.2, fi: 3.3, na: 36, ca: 38, fe: 0.7, kp: 475, va: 961, vc: 19.6, fol: 6, u: { piece: 130 } },
  { n: "poha", a: ["flattened rice cooked", "poha cooked"], st: "COOKED", r: "carb", k: 130, p: 2.5, c: 25, f: 2.5, fi: 1.2, na: 250, fe: 2, u: { plate: 200, bowl: 180 } },
  { n: "idli", a: ["idlis"], st: "COOKED", r: "carb", k: 146, p: 4.5, c: 29, f: 0.4, fi: 1.1, na: 200, ca: 15, fe: 0.8, u: { piece: 40 } },
  { n: "dosa", a: ["plain dosa", "dosas"], st: "COOKED", r: "carb", k: 168, p: 3.9, c: 29, f: 3.7, fi: 1.2, na: 240, ca: 18, fe: 1, u: { piece: 85 } },

  // --- Legumes ---
  { n: "masoor dal", a: ["masur dal", "red lentils", "red lentil dal", "dal masoor", "lentils", "dal", "daal", "lentil soup"], st: "COOKED", r: "protein", k: 116, p: 9, c: 20.1, f: 0.4, fi: 7.9, na: 2, ca: 19, fe: 3.3, kp: 369, fol: 181, u: { bowl: 200, katori: 150, cup: 198 } },
  { n: "moong dal", a: ["mung dal", "green gram dal", "moong"], st: "COOKED", r: "protein", k: 105, p: 7, c: 19, f: 0.4, fi: 7.6, na: 2, ca: 27, fe: 1.4, kp: 266, fol: 159, u: { bowl: 200, katori: 150, cup: 202 } },
  { n: "toor dal", a: ["arhar dal", "tur dal", "pigeon pea dal"], st: "COOKED", r: "protein", k: 118, p: 6.8, c: 21, f: 0.4, fi: 5, na: 5, ca: 29, fe: 1.7, kp: 384, fol: 115, u: { bowl: 200, katori: 150 } },
  { n: "chickpeas", a: ["chana", "chole", "garbanzo", "kabuli chana"], st: "COOKED", r: "protein", k: 164, p: 8.9, c: 27.4, f: 2.6, fi: 7.6, na: 7, ca: 49, fe: 2.9, kp: 291, fol: 172, u: { bowl: 180, cup: 164 } },
  { n: "rajma", a: ["kidney beans", "red kidney beans"], st: "COOKED", r: "protein", k: 127, p: 8.7, c: 22.8, f: 0.5, fi: 6.4, na: 2, ca: 28, fe: 2.9, kp: 403, fol: 130, u: { bowl: 180, cup: 177 } },
  { n: "tofu", a: ["firm tofu", "soya paneer"], st: "PACKAGED", r: "protein", k: 144, p: 15.8, c: 3.9, f: 8.7, fi: 2.3, na: 14, ca: 683, fe: 2.7, kp: 237, u: { piece: 100 } },
  { n: "soya chunks", a: ["soy chunks", "nutrela", "textured soy"], st: "RAW", r: "protein", k: 345, p: 52, c: 33, f: 0.5, fi: 13, na: 20, ca: 350, fe: 20, u: { cup: 40 } },

  // --- Veg & fruit ---
  { n: "mixed vegetables", a: ["vegetables", "veggies", "sabzi", "cooked vegetables", "veg", "mixed veg", "salad"], st: "COOKED", r: "veg", k: 65, p: 2.6, c: 13.1, f: 0.1, fi: 4, na: 43, ca: 25, fe: 0.9, kp: 154, va: 400, vc: 9, fol: 20, u: { bowl: 150, cup: 182 } },
  { n: "broccoli", a: ["cooked broccoli"], st: "COOKED", r: "veg", k: 35, p: 2.4, c: 7.2, f: 0.4, fi: 3.3, na: 41, ca: 40, fe: 0.7, kp: 293, va: 77, vc: 65, fol: 108, u: { cup: 156 } },
  { n: "spinach", a: ["palak", "cooked spinach"], st: "COOKED", r: "veg", k: 23, p: 3, c: 3.8, f: 0.3, fi: 2.4, na: 70, ca: 136, fe: 3.6, kp: 466, va: 524, vc: 9.8, fol: 146, u: { cup: 180 } },
  { n: "cucumber", a: ["kheera", "cucumbers"], st: "RAW", r: "veg", k: 15, p: 0.7, c: 3.6, f: 0.1, fi: 0.5, na: 2, ca: 16, fe: 0.3, kp: 147, vc: 2.8, fol: 7, u: { piece: 200 } },
  { n: "tomato", a: ["tomatoes"], st: "RAW", r: "veg", k: 18, p: 0.9, c: 3.9, f: 0.2, fi: 1.2, na: 5, ca: 10, fe: 0.3, kp: 237, va: 42, vc: 13.7, fol: 15, u: { piece: 120 } },
  { n: "onion", a: ["onions"], st: "RAW", r: "veg", k: 40, p: 1.1, c: 9.3, f: 0.1, fi: 1.7, na: 4, ca: 23, fe: 0.2, kp: 146, vc: 7.4, fol: 19, u: { piece: 110 } },
  { n: "lettuce", a: ["salad greens", "green salad", "mixed greens"], st: "RAW", r: "veg", k: 15, p: 1.4, c: 2.9, f: 0.2, fi: 1.3, na: 28, ca: 36, fe: 0.9, kp: 194, va: 370, vc: 9.2, fol: 38, u: { cup: 50 } },
  { n: "banana", a: ["bananas"], st: "RAW", r: "fruit", k: 89, p: 1.1, c: 22.8, f: 0.3, fi: 2.6, na: 1, ca: 5, fe: 0.3, kp: 358, va: 3, vc: 8.7, fol: 20, u: { piece: 118 } },
  { n: "apple", a: ["apples"], st: "RAW", r: "fruit", k: 52, p: 0.3, c: 13.8, f: 0.2, fi: 2.4, na: 1, ca: 6, fe: 0.1, kp: 107, va: 3, vc: 4.6, fol: 3, u: { piece: 182 } },
  { n: "orange", a: ["oranges", "mosambi", "sweet lime"], st: "RAW", r: "fruit", k: 47, p: 0.9, c: 11.8, f: 0.1, fi: 2.4, na: 0, ca: 40, fe: 0.1, kp: 181, va: 11, vc: 53, fol: 30, u: { piece: 131 } },
  { n: "mango", a: ["mangoes", "aam"], st: "RAW", r: "fruit", k: 60, p: 0.8, c: 15, f: 0.4, fi: 1.6, na: 1, ca: 11, fe: 0.2, kp: 168, va: 54, vc: 36, fol: 43, u: { piece: 200, cup: 165 } },
  { n: "papaya", a: ["papaya ripe"], st: "RAW", r: "fruit", k: 43, p: 0.5, c: 10.8, f: 0.3, fi: 1.7, na: 8, ca: 20, fe: 0.3, kp: 182, va: 47, vc: 61, fol: 37, u: { cup: 140, bowl: 150 } },
  { n: "watermelon", a: [], st: "RAW", r: "fruit", k: 30, p: 0.6, c: 7.6, f: 0.2, fi: 0.4, na: 1, ca: 7, fe: 0.2, kp: 112, va: 28, vc: 8.1, fol: 3, u: { cup: 152, bowl: 250 } },

  // --- Fats, nuts, spreads ---
  { n: "cooking oil", a: ["oil", "vegetable oil", "sunflower oil", "olive oil", "mustard oil", "groundnut oil"], st: "PACKAGED", r: "fat", k: 884, p: 0, c: 0, f: 100, u: { tbsp: 13.5, tsp: 4.5 } },
  { n: "ghee", a: ["clarified butter"], st: "PACKAGED", r: "fat", k: 876, p: 0.3, c: 0, f: 99.5, va: 840, vd: 1.5, u: { tbsp: 14, tsp: 4.7 } },
  { n: "butter", a: ["salted butter"], st: "PACKAGED", r: "fat", k: 717, p: 0.9, c: 0.1, f: 81, na: 643, ca: 24, va: 684, vd: 1.5, u: { tbsp: 14, tsp: 4.7 } },
  { n: "peanut butter", a: ["pb"], st: "PACKAGED", r: "fat", k: 588, p: 25, c: 20, f: 50, fi: 6, na: 17, ca: 49, fe: 1.7, kp: 649, fol: 87, u: { tbsp: 16 } },
  { n: "almonds", a: ["almond", "badam"], st: "RAW", r: "fat", k: 579, p: 21.2, c: 21.6, f: 49.9, fi: 12.5, na: 1, ca: 269, fe: 3.7, kp: 733, fol: 44, u: { piece: 1.2, handful: 28 } },
  { n: "peanuts", a: ["roasted peanuts", "groundnuts", "moongfali"], st: "RAW", r: "fat", k: 567, p: 25.8, c: 16.1, f: 49.2, fi: 8.5, na: 18, ca: 92, fe: 4.6, kp: 705, fol: 240, u: { handful: 28 } },
  { n: "mayonnaise", a: ["mayo"], st: "PACKAGED", r: "fat", k: 680, p: 1, c: 0.6, f: 75, na: 635, ca: 8, u: { tbsp: 14, tsp: 4.7 } },
  { n: "ketchup", a: ["tomato ketchup", "tomato sauce"], st: "PACKAGED", r: "other", k: 101, p: 1, c: 25, f: 0.1, na: 907, ca: 15, kp: 382, vc: 4, u: { tbsp: 17, sachet: 8 } },

  // --- Snacks, sweets, drinks ---
  { n: "biscuit", a: ["biscuits", "marie biscuit", "digestive biscuit", "cookies", "cookie"], st: "PACKAGED", r: "snack", k: 440, p: 7, c: 72, f: 14, fi: 2.5, na: 450, ca: 40, fe: 2, u: { piece: 10 } },
  { n: "potato chips", a: ["chips", "crisps", "lays", "wafers", "potato crisps"], st: "PACKAGED", r: "snack", k: 536, p: 7, c: 53, f: 35, fi: 4.4, na: 525, ca: 24, fe: 1.5, kp: 1275, vc: 20, u: { packet: 30, small_packet: 30, big_packet: 52 } },
  { n: "french fries", a: ["fries", "chips fried potato", "potato fries"], st: "COOKED", r: "snack", k: 312, p: 3.4, c: 41, f: 15, fi: 3.8, na: 210, ca: 10, fe: 0.8, kp: 579, vc: 4, u: { serving: 117, small: 71, medium: 117, large: 154 } },
  { n: "coke", a: ["coca cola", "cola", "pepsi", "soda", "soft drink", "coke can"], st: "PACKAGED", r: "drink", k: 42, p: 0, c: 10.6, f: 0, na: 4, u: { can: 330, bottle: 500, glass: 250 } },
  { n: "diet coke", a: ["coke zero", "diet cola", "diet soda", "pepsi max", "zero sugar cola"], st: "PACKAGED", r: "drink", k: 0.3, p: 0, c: 0, f: 0, na: 12, u: { can: 330, bottle: 500, glass: 250 } },
  { n: "chocolate", a: ["dark chocolate", "milk chocolate", "chocolate bar"], st: "PACKAGED", r: "snack", k: 546, p: 4.9, c: 61, f: 31, fi: 7, na: 24, ca: 56, fe: 8, kp: 559, u: { square: 10, bar: 40 } },
  { n: "ice cream", a: ["icecream", "vanilla ice cream"], st: "PACKAGED", r: "snack", k: 207, p: 3.5, c: 24, f: 11, fi: 0.7, na: 80, ca: 128, kp: 199, va: 118, b12: 0.4, u: { scoop: 66, cup: 132 } },
  { n: "orange juice", a: ["juice", "fruit juice", "packaged juice"], st: "PACKAGED", r: "drink", k: 45, p: 0.7, c: 10.4, f: 0.2, na: 1, ca: 11, kp: 200, vc: 50, fol: 30, u: { glass: 250, cup: 248 } },
  { n: "sugar", a: ["white sugar", "cane sugar"], st: "PACKAGED", r: "other", k: 387, p: 0, c: 100, f: 0, u: { tsp: 4, tbsp: 12.5 } },
  { n: "honey", a: ["shahad"], st: "PACKAGED", r: "other", k: 304, p: 0.3, c: 82, f: 0, u: { tsp: 7, tbsp: 21 } },

  // --- Restaurant / composite dishes: honest LOW-confidence defaults ---
  { n: "chicken biryani", a: ["biryani", "biriyani", "dum biryani", "hyderabadi biryani", "veg biryani", "mutton biryani"], st: "COOKED", r: "meal", k: 190, p: 8.5, c: 24, f: 6.5, fi: 1, na: 350, ca: 25, fe: 1, kp: 160, u: { plate: 350, serving: 350, bowl: 250 }, mixed: true },
  { n: "chicken curry", a: ["butter chicken", "chicken masala", "chicken gravy"], st: "COOKED", r: "meal", k: 150, p: 14, c: 5, f: 8, fi: 1, na: 380, ca: 25, fe: 1, kp: 220, u: { bowl: 250, katori: 150 }, mixed: true, edible: 1 },
  { n: "cheeseburger", a: ["burger", "hamburger", "chicken burger", "veg burger", "mcdonalds burger"], st: "COOKED", r: "meal", k: 260, p: 13, c: 24, f: 12, fi: 1.5, na: 500, ca: 120, fe: 2.2, kp: 180, u: { piece: 180, burger: 180 }, mixed: true },
  { n: "pizza", a: ["pizza slice", "cheese pizza"], st: "COOKED", r: "meal", k: 266, p: 11, c: 33, f: 10, fi: 2.3, na: 598, ca: 188, fe: 2.5, kp: 172, u: { slice: 107, piece: 107 }, mixed: true },
  { n: "sandwich", a: ["veg sandwich", "chicken sandwich", "grilled sandwich"], st: "COOKED", r: "meal", k: 230, p: 10, c: 28, f: 8, fi: 2, na: 450, u: { piece: 150 }, mixed: true },
  { n: "samosa", a: ["samosas", "kachori"], st: "COOKED", r: "snack", k: 262, p: 4.5, c: 28, f: 14.5, fi: 2.5, na: 350, u: { piece: 60 }, mixed: true },
  { n: "paneer curry", a: ["paneer butter masala", "palak paneer", "paneer masala", "kadai paneer"], st: "COOKED", r: "meal", k: 180, p: 8, c: 6, f: 14, fi: 1, na: 380, ca: 180, u: { bowl: 250, katori: 150 }, mixed: true },
  { n: "dal tadka", a: ["dal fry", "dal makhani", "restaurant dal"], st: "COOKED", r: "meal", k: 130, p: 6.5, c: 15, f: 5, fi: 4, na: 330, ca: 30, fe: 2, u: { bowl: 250, katori: 150 }, mixed: true },
  { n: "egg curry", a: ["anda curry", "egg masala"], st: "COOKED", r: "meal", k: 140, p: 8, c: 5, f: 10, fi: 1, na: 360, u: { bowl: 250 }, mixed: true },
];

export const CATALOG: FoodRecord[] = ROWS.map((r) => ({
  name: r.n,
  aliases: r.a ?? [],
  source: "LOCAL" as const,
  state: r.st,
  role: r.r,
  kcal: r.k,
  protein: r.p,
  carbs: r.c,
  fat: r.f,
  fiber: r.fi ?? 0,
  sodium: r.na ?? 0,
  calcium: r.ca ?? 0,
  iron: r.fe ?? 0,
  potassium: r.kp ?? 0,
  vitA: r.va ?? 0,
  vitC: r.vc ?? 0,
  vitD: r.vd ?? 0,
  vitB12: r.b12 ?? 0,
  folate: r.fol ?? 0,
  edibleFraction: r.edible ?? 1,
  unitGrams: r.u ?? {},
  mixed: r.mixed ?? false,
}));
