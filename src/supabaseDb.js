const { createClient } = require("@supabase/supabase-js");

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

function parseMaybeJsonArray(value) {
  if (Array.isArray(value)) return value.map((x) => normalizeText(x));
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((x) => normalizeText(x));
      return [];
    } catch (_error) {
      return value
        .split(",")
        .map((x) => normalizeText(x))
        .filter(Boolean);
    }
  }
  return [];
}

function hydrateFood(row) {
  return {
    id: row.id,
    name: row.name,
    kcal_per_100g: Number(row.kcal_per_100g || 0),
    protein_per_100g: Number(row.protein_per_100g || 0),
    carbs_per_100g: Number(row.carbs_per_100g || 0),
    fat_per_100g: Number(row.fat_per_100g || 0),
    avg_price_tl_per_100g: Number(row.avg_price_tl_per_100g || 0),
    allergens: parseMaybeJsonArray(row.allergens_json ?? row.allergens),
    tags: parseMaybeJsonArray(row.tags_json ?? row.tags)
  };
}

function createSupabaseDb({ url, publishableKey, tableName = "foods", mealPlansTableName = "meal_plans" }) {
  const supabase = createClient(url, publishableKey, {
    auth: { persistSession: false }
  });

  async function initDb() {
    const { error } = await supabase.from(tableName).select("id").limit(1);
    if (error) throw error;
  }

  async function searchFoods({ query = "", preference = "none", excludeAllergens = [] }) {
    const normalizedExclusions = excludeAllergens.map((x) => normalizeText(x));
    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .ilike("name", `%${query}%`)
      .order("avg_price_tl_per_100g", { ascending: true });
    if (error) throw error;

    return (data || [])
      .map(hydrateFood)
      .filter((food) => {
        const foodName = normalizeText(food.name);
        const hasForbiddenAllergen = normalizedExclusions.some((a) => food.allergens.includes(a));
        const isDirectFoodExcluded = normalizedExclusions.includes(foodName);
        if (hasForbiddenAllergen || isDirectFoodExcluded) return false;
        if (preference === "vegan") return food.tags.includes("vegan");
        if (preference === "vegetarian") return food.tags.includes("vegan") || food.tags.includes("vegetarian");
        return true;
      });
  }

  async function getFoodById(id) {
    const { data, error } = await supabase.from(tableName).select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return hydrateFood(data);
  }

  async function saveMealPlan({ accessToken, planName, constraints, planData }) {
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser(accessToken);
    if (userError || !user) throw new Error("Kullanici dogrulanamadi. Tekrar giris yap.");

    const payload = {
      user_id: user.id,
      plan_name: planName || "Haftalik Plan",
      constraints_json: constraints || {},
      plan_json: planData || {}
    };

    const { data, error } = await supabase.from(mealPlansTableName).insert(payload).select("id").single();
    if (error) throw error;
    return data;
  }

  return { initDb, searchFoods, getFoodById, saveMealPlan };
}

module.exports = { createSupabaseDb };
