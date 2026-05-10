const express = require("express");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");
const { createSupabaseDb } = require("./src/supabaseDb");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const LM_STUDIO_BASE_URL = process.env.LM_STUDIO_BASE_URL || "http://127.0.0.1:1234/v1";
const LM_STUDIO_MODEL = process.env.LM_STUDIO_MODEL || "local-model";
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "";
const SUPABASE_FOODS_TABLE = process.env.SUPABASE_FOODS_TABLE || "foods";
const SUPABASE_MEAL_PLANS_TABLE = process.env.SUPABASE_MEAL_PLANS_TABLE || "meal_plans";

const normalizedSupabaseUrl = SUPABASE_URL.replace(/\/rest\/v1\/?$/, "");
const db = createSupabaseDb({
  url: normalizedSupabaseUrl,
  publishableKey: SUPABASE_PUBLISHABLE_KEY,
  tableName: SUPABASE_FOODS_TABLE,
  mealPlansTableName: SUPABASE_MEAL_PLANS_TABLE
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

function scaleNutrition(food, grams) {
  const ratio = grams / 100;
  return {
    kcal: Number((food.kcal_per_100g * ratio).toFixed(2)),
    protein: Number((food.protein_per_100g * ratio).toFixed(2)),
    carbs: Number((food.carbs_per_100g * ratio).toFixed(2)),
    fat: Number((food.fat_per_100g * ratio).toFixed(2))
  };
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, db: "supabase" });
});

app.get("/api/config/public", (_req, res) => {
  res.json({
    supabaseUrl: normalizedSupabaseUrl,
    supabasePublishableKey: SUPABASE_PUBLISHABLE_KEY
  });
});

app.get("/api/foods", async (req, res) => {
  const query = req.query.query || "";
  const preference = req.query.preference || "none";
  const excludeAllergens = req.query.excludeAllergens
    ? String(req.query.excludeAllergens)
        .split(",")
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean)
    : [];
  try {
    const foods = await db.searchFoods({
      query,
      preference,
      excludeAllergens
    });
    res.json({ foods });
  } catch (error) {
    res.status(500).json({ error: "Gida arama basarisiz", details: String(error.message || error) });
  }
});

app.get("/api/foods/:id/nutrition", async (req, res) => {
  const grams = Number(req.query.grams || 100);
  try {
    const food = await db.getFoodById(req.params.id);
    if (!food) {
      return res.status(404).json({ error: "Food bulunamadi" });
    }
    return res.json({
      foodId: req.params.id,
      grams,
      nutrition: scaleNutrition(food, grams)
    });
  } catch (error) {
    return res.status(500).json({ error: "Nutrition hesabi basarisiz", details: String(error.message || error) });
  }
});

app.get("/api/foods/:id/price", async (req, res) => {
  const grams = Number(req.query.grams || 100);
  try {
    const food = await db.getFoodById(req.params.id);
    if (!food) {
      return res.status(404).json({ error: "Food bulunamadi" });
    }
    const priceTl = Number(((food.avg_price_tl_per_100g * grams) / 100).toFixed(2));
    return res.json({ foodId: req.params.id, grams, priceTl });
  } catch (error) {
    return res.status(500).json({ error: "Price hesabi basarisiz", details: String(error.message || error) });
  }
});

app.post("/api/llm/meal-explanation", async (req, res) => {
  const { planText, targets, constraints } = req.body || {};
  if (!planText) {
    return res.status(400).json({ error: "planText gerekli" });
  }

  const systemPrompt =
    "Sen bir beslenme plani asistanisin. Asla tibbi tani koyma. Ciktilar kisa, net ve uygulanabilir olsun.";
  const userPrompt = `Kisitlar: ${JSON.stringify(constraints || {})}
Hedefler: ${JSON.stringify(targets || {})}
Plan:
${planText}

Kisa bir aciklama yap ve 2 alternatif degisim onerisi ver.`;

  try {
    const response = await fetch(`${LM_STUDIO_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: LM_STUDIO_MODEL,
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ]
      })
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(502).json({
        error: "LM Studio yanit vermedi",
        details: text
      });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "LLM aciklamasi alinamadi.";
    return res.json({ content });
  } catch (error) {
    return res.status(502).json({
      error: "LM Studio baglantisi basarisiz",
      details: String(error.message || error)
    });
  }
});

app.post("/api/plans", async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Yetkisiz istek. Giris yap." });

    const { planName, constraints, planData } = req.body || {};
    if (!planData) return res.status(400).json({ error: "planData gerekli." });

    const saved = await db.saveMealPlan({ accessToken: token, planName, constraints, planData });
    return res.json({ ok: true, planId: saved.id });
  } catch (error) {
    return res.status(500).json({ error: "Plan kaydedilemedi", details: String(error.message || error) });
  }
});

db
  .initDb()
  .then(() => {
    console.log(`Supabase foods table OK: ${SUPABASE_FOODS_TABLE}`);
  })
  .catch((error) => {
    console.error("DB init warning:", error.message || error);
    console.error(`SUPABASE_FOODS_TABLE degerini kontrol et. Su an: ${SUPABASE_FOODS_TABLE}`);
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  });
