const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "nutrition.db");
const db = new sqlite3.Database(DB_PATH);

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

const seedFoods = [
  {
    id: "oat",
    name: "Yulaf",
    kcal: 389,
    protein: 16.9,
    carbs: 66.3,
    fat: 6.9,
    allergens: ["gluten"],
    tags: ["vegetarian"],
    avgPrice: 4.5
  },
  {
    id: "rice",
    name: "Pirinc",
    kcal: 130,
    protein: 2.4,
    carbs: 28.7,
    fat: 0.2,
    allergens: [],
    tags: ["vegan", "vegetarian"],
    avgPrice: 2.2
  },
  {
    id: "chicken",
    name: "Tavuk Gogus",
    kcal: 165,
    protein: 31,
    carbs: 0,
    fat: 3.6,
    allergens: [],
    tags: [],
    avgPrice: 8.5
  },
  {
    id: "egg",
    name: "Yumurta",
    kcal: 155,
    protein: 13,
    carbs: 1.1,
    fat: 11,
    allergens: ["egg"],
    tags: ["vegetarian"],
    avgPrice: 5
  },
  {
    id: "tofu",
    name: "Tofu",
    kcal: 76,
    protein: 8,
    carbs: 1.9,
    fat: 4.8,
    allergens: ["soy"],
    tags: ["vegan", "vegetarian"],
    avgPrice: 7.5
  },
  {
    id: "lentil",
    name: "Mercimek",
    kcal: 116,
    protein: 9,
    carbs: 20,
    fat: 0.4,
    allergens: [],
    tags: ["vegan", "vegetarian"],
    avgPrice: 2.8
  },
  {
    id: "banana",
    name: "Muz",
    kcal: 89,
    protein: 1.1,
    carbs: 23,
    fat: 0.3,
    allergens: [],
    tags: ["vegan", "vegetarian"],
    avgPrice: 3.2
  },
  {
    id: "almond",
    name: "Badem",
    kcal: 579,
    protein: 21,
    carbs: 22,
    fat: 50,
    allergens: ["nuts"],
    tags: ["vegan", "vegetarian"],
    avgPrice: 14
  },
  {
    id: "salmon",
    name: "Somon",
    kcal: 208,
    protein: 20,
    carbs: 0,
    fat: 13,
    allergens: ["fish"],
    tags: [],
    avgPrice: 18
  },
  {
    id: "potato",
    name: "Patates",
    kcal: 77,
    protein: 2,
    carbs: 17,
    fat: 0.1,
    allergens: [],
    tags: ["vegan", "vegetarian"],
    avgPrice: 1.8
  },
  {
    id: "yogurt",
    name: "Yogurt",
    kcal: 59,
    protein: 10,
    carbs: 3.6,
    fat: 0.4,
    allergens: ["lactose"],
    tags: ["vegetarian"],
    avgPrice: 4.2
  },
  {
    id: "chickpea",
    name: "Nohut",
    kcal: 164,
    protein: 8.9,
    carbs: 27.4,
    fat: 2.6,
    allergens: [],
    tags: ["vegan", "vegetarian"],
    avgPrice: 3.4
  },
  {
    id: "bulgur",
    name: "Bulgur",
    kcal: 83,
    protein: 3.1,
    carbs: 18.6,
    fat: 0.2,
    allergens: ["gluten"],
    tags: ["vegan", "vegetarian"],
    avgPrice: 2.4
  },
  {
    id: "spinach",
    name: "Ispanak",
    kcal: 23,
    protein: 2.9,
    carbs: 3.6,
    fat: 0.4,
    allergens: [],
    tags: ["vegan", "vegetarian"],
    avgPrice: 2.1
  },
  {
    id: "avocado",
    name: "Avokado",
    kcal: 160,
    protein: 2,
    carbs: 8.5,
    fat: 14.7,
    allergens: [],
    tags: ["vegan", "vegetarian"],
    avgPrice: 7.5
  },
  {
    id: "apple",
    name: "Elma",
    kcal: 52,
    protein: 0.3,
    carbs: 14,
    fat: 0.2,
    allergens: [],
    tags: ["vegan", "vegetarian"],
    avgPrice: 2.3
  },
  {
    id: "beef",
    name: "Dana Eti",
    kcal: 250,
    protein: 26,
    carbs: 0,
    fat: 15,
    allergens: [],
    tags: [],
    avgPrice: 16
  },
  {
    id: "pasta",
    name: "Makarna",
    kcal: 131,
    protein: 5,
    carbs: 25,
    fat: 1.1,
    allergens: ["gluten"],
    tags: ["vegan", "vegetarian"],
    avgPrice: 2.7
  }
];

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) return reject(error);
      return resolve(this);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) return reject(error);
      return resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) return reject(error);
      return resolve(row);
    });
  });
}

async function initDb() {
  await run(`
    CREATE TABLE IF NOT EXISTS foods (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kcal_per_100g REAL NOT NULL,
      protein_per_100g REAL NOT NULL,
      carbs_per_100g REAL NOT NULL,
      fat_per_100g REAL NOT NULL,
      allergens_json TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      avg_price_tl_per_100g REAL NOT NULL
    )
  `);

  for (const food of seedFoods) {
    await run(
      `INSERT INTO foods (
        id, name, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
        allergens_json, tags_json, avg_price_tl_per_100g
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        kcal_per_100g = excluded.kcal_per_100g,
        protein_per_100g = excluded.protein_per_100g,
        carbs_per_100g = excluded.carbs_per_100g,
        fat_per_100g = excluded.fat_per_100g,
        allergens_json = excluded.allergens_json,
        tags_json = excluded.tags_json,
        avg_price_tl_per_100g = excluded.avg_price_tl_per_100g`,
      [
        food.id,
        food.name,
        food.kcal,
        food.protein,
        food.carbs,
        food.fat,
        JSON.stringify(food.allergens),
        JSON.stringify(food.tags),
        food.avgPrice
      ]
    );
  }
}

function hydrateFood(row) {
  if (!row) return null;
  return {
    ...row,
    allergens: JSON.parse(row.allergens_json || "[]"),
    tags: JSON.parse(row.tags_json || "[]")
  };
}

async function searchFoods({ query = "", preference = "none", excludeAllergens = [] }) {
  const normalizedExclusions = excludeAllergens.map((x) => normalizeText(x));
  const rows = await all(
    `SELECT * FROM foods WHERE lower(name) LIKE ? ORDER BY avg_price_tl_per_100g ASC`,
    [`%${String(query).toLowerCase()}%`]
  );

  return rows
    .map(hydrateFood)
    .filter((food) => {
      const foodName = normalizeText(food.name);
      const hasForbiddenAllergen = normalizedExclusions.some((a) => food.allergens.includes(a));
      const isDirectFoodExcluded = normalizedExclusions.includes(foodName);
      if (hasForbiddenAllergen || isDirectFoodExcluded) return false;
      if (preference === "none") return true;
      if (preference === "vegan") return food.tags.includes("vegan");
      if (preference === "vegetarian") return food.tags.includes("vegan") || food.tags.includes("vegetarian");
      return true;
    });
}

async function getFoodById(id) {
  const row = await get(`SELECT * FROM foods WHERE id = ?`, [id]);
  return hydrateFood(row);
}

module.exports = {
  initDb,
  searchFoods,
  getFoodById
};
