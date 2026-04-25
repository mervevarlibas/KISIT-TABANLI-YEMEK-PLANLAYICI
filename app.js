const DAY_NAMES = ["Pazartesi", "Sali", "Carsamba", "Persembe", "Cuma", "Cumartesi", "Pazar"];

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
  if (!response.ok) {
    throw new Error("Gida servisi erisilemiyor.");
  }
  const data = await response.json();
  return data.foods || [];
}

async function get_food_nutrition(foodId, grams) {
  const response = await fetch(`/api/foods/${foodId}/nutrition?grams=${grams}`);
  if (!response.ok) {
    throw new Error("Nutrition servisi erisilemiyor.");
  }
  const data = await response.json();
  return data.nutrition;
}

async function get_food_price(foodId, grams) {
  const response = await fetch(`/api/foods/${foodId}/price?grams=${grams}`);
  if (!response.ok) {
    throw new Error("Fiyat servisi erisilemiyor.");
  }
  const data = await response.json();
  return data.priceTl || 0;
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
    if (intersect.length) {
      violations.push({ item: item.food.name, allergens: intersect });
    }
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

async function optimize_plan(constraints) {
  const candidateFoods = (await search_foods("", {
    excludeAllergens: constraints.allergens,
    preference: constraints.dietPreference
  })).filter((food) => !constraints.dislikes.includes(food.name.toLowerCase()));

  const affordable = [...candidateFoods].sort((a, b) => a.avg_price_tl_per_100g - b.avg_price_tl_per_100g);
  const proteinFirst = [...candidateFoods].sort(
    (a, b) => b.protein_per_100g - a.protein_per_100g
  );

  if (!affordable.length || !proteinFirst.length) {
    return { mealsByDay: [], weeklyCost: 0, macroSummary: null, reason: "Aday gida bulunamadi." };
  }

  const mealsByDay = [];
  let weeklyCost = 0;
  const macroSummary = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const gramsPerMeal = Math.round(700 / constraints.mealCount);

  for (let day = 0; day < 7; day += 1) {
    const meals = [];
    for (let m = 0; m < constraints.mealCount; m += 1) {
      const base = affordable[(day + m) % affordable.length];
      const support = proteinFirst[(day + m + 1) % proteinFirst.length];
      const items = [
        { food: base, grams: gramsPerMeal },
        { food: support, grams: Math.round(gramsPerMeal * 0.8) }
      ];
      meals.push({ name: `Ogun ${m + 1}`, items });

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
    .map((d) => `${d.day}: ${d.meals.map((m) => `${m.name} ${m.items.map((i) => i.food.name).join(" + ")}`).join(" | ")}`)
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
    return {
      allergyViolations: [{ item: "Plan", allergens: ["Uygun gida bulunamadi"] }],
      budgetOk: true,
      kcalTolerance: false
    };
  }
  const allItems = plan.mealsByDay.flatMap((d) => d.meals.flatMap((m) => m.items));
  const allergyViolations = check_allergens(allItems, input.allergens);
  const budgetOk = plan.weeklyCost <= input.weeklyBudget;
  const kcalTolerance = Math.abs(plan.macroSummary.kcal - targets.kcal * 7) / (targets.kcal * 7) <= 0.15;
  return {
    allergyViolations,
    budgetOk,
    kcalTolerance
  };
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
  return [...map.entries()].map(([name, info]) => ({
    name,
    grams: Math.round(info.grams),
    estimatedTl: Number(info.estimatedTl.toFixed(2))
  }));
}

function parseCsvText(text) {
  return text
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

function renderResults(plan, validation, llmText, targets, input) {
  resultCard.classList.remove("hidden");
  validationEl.innerHTML = `
    <p class="${validation.allergyViolations.length ? "danger" : "safe"}">
      Alerjen kontrolu: ${
        validation.allergyViolations.length
          ? "IHLAL var - plan reddedildi."
          : "Guvenli (ihlal yok)."
      }
    </p>
    <p class="${validation.budgetOk ? "safe" : "warning"}">
      Butce kontrolu: ${validation.budgetOk ? "Uygun" : "Asildi"} (${plan.weeklyCost} TL / ${
    input.weeklyBudget
  } TL)
    </p>
    <p class="${validation.kcalTolerance ? "safe" : "warning"}">
      Makro-kalori toleransi: ${
        validation.kcalTolerance ? "Hedefe yakin" : "Sapma yuksek"
      } (haftalik hedef: ${targets.kcal * 7} kcal)
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
        .map(
          (meal) =>
            `<p><strong>${meal.name}:</strong> ${meal.items
              .map((i) => `${i.food.name} (${i.grams}g)`)
              .join(" + ")}</p>`
        )
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
    allergens: parseCsvText(document.getElementById("allergens").value),
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
    showError(
      "Plan olusturulamadi. Uygulamayi http://localhost:3000 uzerinden ac ve sunucunun calistigindan emin ol (npm start)."
    );
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
