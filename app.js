const DAY_NAMES = ["Pazartesi", "Sali", "Carsamba", "Persembe", "Cuma", "Cumartesi", "Pazar"];
const MEAL_LABELS = {
  3: ["Kahvalti", "Ogle", "Aksam"],
  4: ["Kahvalti", "Ara Ogun", "Ogle", "Aksam"],
  5: ["Kahvalti", "Ara Ogun 1", "Ogle", "Ara Ogun 2", "Aksam"]
};
const ALLERGEN_ALIASES = {
  gluten: ["gluten", "bugday", "wheat"],
  nuts: ["nuts", "findik", "ceviz", "badem", "kuruyemis"],
  lactose: ["lactose", "laktoz", "sut"],
  egg: ["egg", "yumurta"],
  soy: ["soy", "soya"],
  fish: ["fish", "balik"]
};

const form = document.getElementById("plannerForm");
const resultCard = document.getElementById("resultCard");
const validationEl = document.getElementById("validation");
const planOutput = document.getElementById("planOutput");
const shoppingList = document.getElementById("shoppingList");
const replanBtn = document.getElementById("replanBtn");

let latestPlan = null;
let latestInput = null;

function showError(message) {
  resultCard.classList.remove("hidden");
  validationEl.innerHTML = `<p class="danger">${message}</p>`;
  planOutput.innerHTML = "";
  shoppingList.innerHTML = "";
}

async function search_foods(query, filters = {}) {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  if (filters.preference) params.set("preference", filters.preference);
  if (filters.excludeAllergens?.length) params.set("excludeAllergens", filters.excludeAllergens.join(","));
  const response = await fetch(`/api/foods?${params.toString()}`);
  if (!response.ok) throw new Error("Gida servisi erisilemiyor.");
  const data = await response.json();
  return data.foods || [];
}

function get_food_nutrition_local(food, grams) {
  const ratio = grams / 100;
  return {
    kcal: Number((food.kcal_per_100g * ratio).toFixed(2)),
    protein: Number((food.protein_per_100g * ratio).toFixed(2)),
    carbs: Number((food.carbs_per_100g * ratio).toFixed(2)),
    fat: Number((food.fat_per_100g * ratio).toFixed(2))
  };
}

function get_food_price_local(food, grams) {
  return Number(((food.avg_price_tl_per_100g * grams) / 100).toFixed(2));
}

function check_allergens(mealItems, userAllergens) {
  const violations = [];
  for (const item of mealItems) {
    const intersect = item.food.allergens.filter((a) => userAllergens.includes(a));
    if (intersect.length) violations.push({ item: item.food.name, allergens: intersect });
  }
  return violations;
}

function calculateTargets(profile) {
  const bmr =
    profile.gender === "male"
      ? 10 * profile.weight + 6.25 * profile.height - 5 * profile.age + 5
      : 10 * profile.weight + 6.25 * profile.height - 5 * profile.age - 161;
  const tdee = bmr * profile.activity;
  const kcalGoal = profile.goal === "lose" ? tdee - 400 : profile.goal === "gain" ? tdee + 300 : tdee;
  return {
    kcal: Math.round(kcalGoal),
    protein: Math.round((kcalGoal * 0.3) / 4),
    carbs: Math.round((kcalGoal * 0.4) / 4),
    fat: Math.round((kcalGoal * 0.3) / 9)
  };
}

function parseCsvText(text) {
  return text
    .split(",")
    .map((x) => normalizeText(x))
    .filter(Boolean);
}

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

function normalizeUserAllergens(allergens) {
  const normalized = new Set();
  for (const raw of allergens) {
    let matched = false;
    for (const [canonical, aliases] of Object.entries(ALLERGEN_ALIASES)) {
      if (aliases.includes(raw)) {
        normalized.add(canonical);
        matched = true;
      }
    }
    if (!matched) normalized.add(raw);
  }
  return [...normalized];
}

function getMealTemplatePool(dietPreference = "none") {
  const templates = [
    { mealType: "Kahvalti", recipeName: "Yulafli Muz Kasesi", items: [{ id: "oat", grams: 80 }, { id: "banana", grams: 120 }] },
    { mealType: "Kahvalti", recipeName: "Yumurtali Pirinc Tabagi", items: [{ id: "egg", grams: 120 }, { id: "rice", grams: 120 }] },
    { mealType: "Kahvalti", recipeName: "Yogurt ve Elma Kasesi", items: [{ id: "yogurt", grams: 180 }, { id: "apple", grams: 140 }] },
    { mealType: "Kahvalti", recipeName: "Ispanakli Omlet", items: [{ id: "egg", grams: 140 }, { id: "spinach", grams: 120 }] },
    { mealType: "Ogle", recipeName: "Tavuklu Pirinc Pilavi", items: [{ id: "chicken", grams: 160 }, { id: "rice", grams: 180 }] },
    { mealType: "Ogle", recipeName: "Mercimekli Pirinc Pilavi", items: [{ id: "lentil", grams: 180 }, { id: "rice", grams: 140 }] },
    { mealType: "Ogle", recipeName: "Nohutlu Bulgur Pilavi", items: [{ id: "chickpea", grams: 180 }, { id: "bulgur", grams: 160 }] },
    { mealType: "Ogle", recipeName: "Somon ve Patates", items: [{ id: "salmon", grams: 150 }, { id: "potato", grams: 180 }] },
    { mealType: "Ogle", recipeName: "Dana Eti ve Bulgur", items: [{ id: "beef", grams: 150 }, { id: "bulgur", grams: 170 }] },
    { mealType: "Aksam", recipeName: "Tavuk ve Mercimek Tabagi", items: [{ id: "chicken", grams: 150 }, { id: "lentil", grams: 160 }] },
    { mealType: "Aksam", recipeName: "Tofulu Pirinc Bowl", items: [{ id: "tofu", grams: 180 }, { id: "rice", grams: 160 }] },
    { mealType: "Aksam", recipeName: "Tavuklu Makarna", items: [{ id: "chicken", grams: 150 }, { id: "pasta", grams: 160 }] },
    { mealType: "Aksam", recipeName: "Nohut ve Pirinc Tabagi", items: [{ id: "chickpea", grams: 180 }, { id: "rice", grams: 150 }] },
    { mealType: "Aksam", recipeName: "Ispanakli Tofu Sote", items: [{ id: "tofu", grams: 180 }, { id: "spinach", grams: 140 }] },
    { mealType: "Ara Ogun", recipeName: "Muz ve Badem Atistirmasi", items: [{ id: "banana", grams: 120 }, { id: "almond", grams: 30 }] },
    { mealType: "Ara Ogun", recipeName: "Mercimek Salatasi", items: [{ id: "lentil", grams: 140 }] },
    { mealType: "Ara Ogun", recipeName: "Elma ve Badem", items: [{ id: "apple", grams: 160 }, { id: "almond", grams: 25 }] },
    { mealType: "Ara Ogun", recipeName: "Avokadolu Ara Ogun", items: [{ id: "avocado", grams: 90 }, { id: "banana", grams: 90 }] }
  ];

  if (dietPreference === "vegan") return templates.filter((t) => !t.items.some((i) => ["chicken", "egg"].includes(i.id)));
  if (dietPreference === "vegetarian") return templates.filter((t) => !t.items.some((i) => i.id === "chicken"));
  return templates;
}

async function optimize_plan(constraints) {
  const candidateFoods = await search_foods("", {
    excludeAllergens: constraints.allergens,
    preference: constraints.dietPreference
  });
  const filteredFoods = candidateFoods.filter((food) => !constraints.dislikes.includes(normalizeText(food.name)));
  const foodMap = new Map(filteredFoods.map((food) => [food.id, food]));
  const templates = getMealTemplatePool(constraints.dietPreference).filter((template) =>
    template.items.every((item) => foodMap.has(item.id))
  );
  if (!templates.length) return { mealsByDay: [], weeklyCost: 0, macroSummary: null, reason: "Aday gida bulunamadi." };

  const mealsByDay = [];
  let weeklyCost = 0;
  const macroSummary = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const labels = MEAL_LABELS[constraints.mealCount] || MEAL_LABELS[3];

  for (let day = 0; day < 7; day += 1) {
    const meals = [];
    for (let mealIndex = 0; mealIndex < constraints.mealCount; mealIndex += 1) {
      const mealLabel = labels[mealIndex];
      const wantedType = mealLabel.startsWith("Ara Ogun") ? "Ara Ogun" : mealLabel;
      const typedTemplates = templates.filter((t) => t.mealType === wantedType);
      const pool = typedTemplates.length ? typedTemplates : templates;
      const selected = pool[(day + mealIndex) % pool.length];
      const items = selected.items.map((item) => ({ food: foodMap.get(item.id), grams: item.grams }));
      meals.push({ name: mealLabel, recipeName: selected.recipeName, items });

      for (const item of items) {
        const nut = get_food_nutrition_local(item.food, item.grams);
        macroSummary.kcal += nut.kcal;
        macroSummary.protein += nut.protein;
        macroSummary.carbs += nut.carbs;
        macroSummary.fat += nut.fat;
        weeklyCost += get_food_price_local(item.food, item.grams);
      }
    }
    mealsByDay.push({ day: DAY_NAMES[day], meals });
  }

  return {
    mealsByDay,
    weeklyCost: Number(weeklyCost.toFixed(2)),
    macroSummary: {
      kcal: Math.round(macroSummary.kcal),
      protein: Math.round(macroSummary.protein),
      carbs: Math.round(macroSummary.carbs),
      fat: Math.round(macroSummary.fat)
    },
    reason: ""
  };
}

async function renderLLMExplanation(plan, targets, constraints) {
  if (!plan.mealsByDay.length) return "Plan olusturulamadi: uygun gida seti yok.";
  const planText = plan.mealsByDay
    .map((d) =>
      `${d.day}: ${d.meals
        .map((m) => `${m.name} - ${m.recipeName} (${m.items.map((i) => i.food.name).join(" + ")})`)
        .join(" | ")}`
    )
    .join("\n");
  try {
    const response = await fetch("/api/llm/meal-explanation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planText, targets, constraints })
    });
    const data = await response.json();
    if (!response.ok) return "LM Studio bagli degil veya model secili degil.";
    return data.content;
  } catch (_error) {
    return "LM Studio baglantisi kurulamadi.";
  }
}

function validatePlan(plan, input, targets) {
  if (!plan.macroSummary) {
    return { allergyViolations: [{ item: "Plan", allergens: ["Uygun gida bulunamadi"] }], budgetOk: true, kcalTolerance: false };
  }
  const allItems = plan.mealsByDay.flatMap((d) => d.meals.flatMap((m) => m.items));
  const allergyViolations = check_allergens(allItems, input.allergens);
  const budgetOk = plan.weeklyCost <= input.weeklyBudget;
  const kcalTolerance = Math.abs(plan.macroSummary.kcal - targets.kcal * 7) / (targets.kcal * 7) <= 0.15;
  return { allergyViolations, budgetOk, kcalTolerance };
}

async function buildShoppingList(plan) {
  const map = new Map();
  for (const day of plan.mealsByDay) {
    for (const meal of day.meals) {
      for (const item of meal.items) {
        const current = map.get(item.food.name) || { grams: 0, estimatedTl: 0 };
        current.grams += item.grams;
        current.estimatedTl += get_food_price_local(item.food, item.grams);
        map.set(item.food.name, current);
      }
    }
  }
  return [...map.entries()].map(([name, info]) => ({ name, grams: Math.round(info.grams), estimatedTl: Number(info.estimatedTl.toFixed(2)) }));
}

function renderResults(plan, validation, llmText, targets, input) {
  resultCard.classList.remove("hidden");
  validationEl.innerHTML = `
    <p class="${validation.allergyViolations.length ? "danger" : "safe"}">
      Alerjen kontrolu: ${validation.allergyViolations.length ? "IHLAL var - plan reddedildi." : "Guvenli (ihlal yok)."}
    </p>
    <p class="${validation.budgetOk ? "safe" : "warning"}">
      Butce kontrolu: ${validation.budgetOk ? "Uygun" : "Asildi"} (${plan.weeklyCost} TL / ${input.weeklyBudget} TL)
    </p>
    <p class="${validation.kcalTolerance ? "safe" : "warning"}">
      Makro-kalori toleransi: ${validation.kcalTolerance ? "Hedefe yakin" : "Sapma yuksek"} (haftalik hedef: ${targets.kcal * 7} kcal)
    </p>
    <p id="llmText">${llmText}</p>
  `;

  planOutput.innerHTML = "";
  for (const day of plan.mealsByDay) {
    const block = document.createElement("div");
    block.className = "day-block";
    block.innerHTML = `
      <h3>${day.day}</h3>
      ${day.meals
        .map((meal) => `<p><strong>${meal.name}:</strong> ${meal.recipeName} - ${meal.items.map((i) => `${i.food.name} (${i.grams}g)`).join(" + ")}</p>`)
        .join("")}
    `;
    planOutput.appendChild(block);
  }
}

function updateLlmText(llmText) {
  const llmEl = document.getElementById("llmText");
  if (llmEl) llmEl.textContent = llmText;
}

function renderShoppingList(list) {
  shoppingList.innerHTML = "";
  for (const item of list) {
    const li = document.createElement("li");
    li.textContent = `${item.name}: ${item.grams}g (~${item.estimatedTl} TL)`;
    shoppingList.appendChild(li);
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const input = {
    weight: Number(document.getElementById("weight").value),
    height: Number(document.getElementById("height").value),
    age: Number(document.getElementById("age").value),
    gender: document.getElementById("gender").value,
    activity: Number(document.getElementById("activity").value),
    mealCount: Number(document.getElementById("mealCount").value),
    weeklyBudget: Number(document.getElementById("budget").value),
    goal: document.getElementById("goal").value,
    allergens: normalizeUserAllergens(parseCsvText(document.getElementById("allergens").value)),
    dietPreference: document.getElementById("dietPreference").value,
    dislikes: parseCsvText(document.getElementById("dislikes").value)
  };

  try {
    const targets = calculateTargets(input);
    const plan = await optimize_plan(input);
    const validation = validatePlan(plan, input, targets);
    latestInput = input;
    latestPlan = plan;
    renderResults(plan, validation, "LLM aciklamasi aliniyor...", targets, input);
    renderShoppingList(await buildShoppingList(plan));
    const llmText = await renderLLMExplanation(plan, targets, input);
    updateLlmText(llmText);
  } catch (_error) {
    showError("Plan olusturulamadi. Uygulamayi http://localhost:3000 uzerinden ac ve sunucunun calistigindan emin ol (npm start).");
  }
});

replanBtn.addEventListener("click", async () => {
  if (!latestInput || !latestPlan) return;
  latestInput.dislikes = [...new Set([...latestInput.dislikes, "pirinc"])];
  const newPlan = await optimize_plan(latestInput);
  const targets = calculateTargets(latestInput);
  const validation = validatePlan(newPlan, latestInput, targets);
  latestPlan = newPlan;
  renderResults(newPlan, validation, "LLM aciklamasi aliniyor...", targets, latestInput);
  renderShoppingList(await buildShoppingList(newPlan));
  const llmText = await renderLLMExplanation(newPlan, targets, latestInput);
  updateLlmText(llmText);
});
