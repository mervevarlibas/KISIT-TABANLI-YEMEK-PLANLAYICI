const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "nutrition.db");
const db = new sqlite3.Database(DB_PATH);

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

  const row = await get("SELECT COUNT(1) AS count FROM foods");
  if (!row || row.count === 0) {
    for (const food of seedFoods) {
      await run(
        `INSERT INTO foods (
          id, name, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
          allergens_json, tags_json, avg_price_tl_per_100g
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
  const rows = await all(
    `SELECT * FROM foods WHERE lower(name) LIKE ? ORDER BY avg_price_tl_per_100g ASC`,
    [`%${String(query).toLowerCase()}%`]
  );

  return rows
    .map(hydrateFood)
    .filter((food) => {
      const hasForbiddenAllergen = excludeAllergens.some((a) => food.allergens.includes(a));
      if (hasForbiddenAllergen) return false;
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
