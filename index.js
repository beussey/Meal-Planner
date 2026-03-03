const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.static("public"));

function getCurrentMonthText() {
  const months = [
    "jan","feb","mar","apr","may","jun",
    "jul","aug","sep","oct","nov","dec"
  ];
  return months[new Date().getMonth()];
}

function loadRecipes() {
  const filePath = path.join(__dirname, "data", "recipes.json");
  const data = fs.readFileSync(filePath, "utf8");
  const recipes = JSON.parse(data);

  // On initialise lastUsed automatiquement si absent
  return recipes.map(r => ({
    ...r,
    lastUsed: r.lastUsed || 0
  }));
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ===== NORMALISATION =====
function normalize(str) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // supprime accents
    .replace(/-/g, " ")               // uniformise tirets
    .replace(/[^\w\s]/g, "")          // retire ponctuation
    .replace(/\s+/g, " ")             // espaces multiples
    .trim();
}

// mots à ne JAMAIS singulariser
const invariantWords = new Set([
  "mais",
  "pois",
  "noix",
  "riz",
  "houmous"
]);

// gestion pluriel plus propre
function singularize(word) {
  if (invariantWords.has(word)) return word;

  if (word.endsWith("aux")) return word.slice(0, -3) + "al";
  if (word.endsWith("eaux")) return word.slice(0, -1); // ex: poireaux
  if (word.endsWith("s") && word.length > 3) return word.slice(0, -1);
  if (word.endsWith("x") && word.length > 3) return word.slice(0, -1);

  return word;
}

function prepare(str) {
  return normalize(str)
    .split(" ")
    .map(singularize)
    .join(" ");
}

function containsIngredient(preparedName, preparedBase) {
  const regex = new RegExp(`\\b${preparedBase}\\b`);
  return regex.test(preparedName);
}
// ===== LISTES PRÉPARÉES UNE FOIS =====

const vegetables = [
  "carotte","poireau","citron","chou","courgette","epinard",
  "panais","celeri","oignon","echalote","ail","poivron",
  "pomme de terre","chou fleur","aubergine","tomate",
  "concombre","fenouil","butternut","potimarron",
  "champignon","salade","haricot vert","brocoli",
  "radis","navet","blette","asperge","artichaut",
  "betterave","endive","petit pois","gingembre",
  "patate douce","courge","avocat","pois chiche"
].map(prepare);

const meats = [
  "poulet","boeuf","porc","dinde",
  "veau","agneau","canard",
  "lard","saucisse","bacon","steak",
  "epaule","jarret","lardon","jambon",
  "chorizo","gite de boeuf","jarret de boeuf","gite"
].map(prepare);

const fish = [
  "saumon","cabillaud","colin","truite",
  "thon","merlu","maquereau","sardine",
  "crevette"
].map(prepare);

const dairy = [
  "lait","beurre","fromage","ricotta",
  "parmesan","creme","yaourt",
  "mozzarella","chevre","comte",
  "cream cheese","reblochon","burrata",
  "feta","cheddar"
].map(prepare);
// ===== CATÉGORISATION =====
function categorizeIngredient(name) {

  const prepared = prepare(name);

  if (vegetables.some(v => containsIngredient(prepared, v))) return "🥕 Légumes";
  if (meats.some(m => containsIngredient(prepared, m))) return "🥩 Viande";
  if (fish.some(f => containsIngredient(prepared, f))) return "🐟 Poisson";
  if (dairy.some(d => containsIngredient(prepared, d))) return "🧀 Crèmerie";

  return "🧂 Épicerie";
}


app.get("/", (req, res) => {
  res.status(200).sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/generate-week", (req, res) => {

  const people = parseInt(req.query.people) || 2;
  const ratio = people / 2;
  const ignoreSeason = req.query.ignoreSeason === "true";

  const ingredientsToUse = (req.query.use || "")
    .toLowerCase()
    .split(",")
    .map(i => i.trim())
    .filter(i => i.length > 0);

  const allRecipes = loadRecipes();
  const currentMonth = getCurrentMonthText();

  let lastGeneration = [];
  try {
    lastGeneration = JSON.parse(fs.readFileSync("data/last_week.json"));
  } catch {
    lastGeneration = [];
  }

  // ===== FILTRAGE SAISON + ROTATION =====
  const seasonal = allRecipes
  .filter(r =>
    (ignoreSeason || r.season_months.includes(currentMonth)) &&
    r.contains_mussels === false
  )
    .sort((a, b) => (a.lastUsed || 0) - (b.lastUsed || 0));

  // ===== QUOTAS DYNAMIQUES =====
  const meatTarget = 1 + Math.floor(Math.random() * 3);
  const fishTarget = 1 + Math.floor(Math.random() * 2);
  let vegetarianTarget = 10 - meatTarget - fishTarget;
  if (vegetarianTarget < 3) vegetarianTarget = 3;

  let selected = [];

 const meatRecipes = seasonal.filter(r => r.category === "meat");
const fishRecipes = seasonal.filter(r => r.category === "fish");
const vegetarianRecipes = seasonal.filter(r => r.category === "vegetarian");

  let meatCount = 0;
  let fishCount = 0;
  let vegCount = 0;
  let heavyCreamCount = 0;
  let longCount = 0;
  let veryLongCount = 0;

  function canAdd(recipe) {
    if (recipe.category === "meat" && meatCount >= 3) return false;
    if (recipe.category === "fish" && fishCount >= 2) return false;
    if (recipe.cream_heavy && heavyCreamCount >= 2) return false;
    if (recipe.prep_time > 100 && veryLongCount >= 1) return false;
    if (recipe.prep_time > 40 && longCount >= 3) return false;
    return true;
  }

  function addRecipe(recipe) {
    selected.push(recipe);
    if (recipe.category === "meat") meatCount++;
    if (recipe.category === "fish") fishCount++;
    if (recipe.category === "vegetarian") vegCount++;
    if (recipe.cream_heavy) heavyCreamCount++;
    if (recipe.prep_time > 40) longCount++;
    if (recipe.prep_time > 100) veryLongCount++;
  }

// ===== INGREDIENT FORCÉ INTELLIGENT =====
let forcedRecipeId = null;

if (ingredientsToUse.length > 0) {

  let matchingRecipes = seasonal.filter(recipe =>
    recipe.ingredients.some(ing =>
      ingredientsToUse.some(userIng =>
        containsIngredient(
          prepare(ing.name),
          prepare(userIng)
        )
      )
    )
  );

  // On évite la semaine précédente
  matchingRecipes = matchingRecipes.filter(r =>
    !lastGeneration.includes(r.id)
  );

  if (matchingRecipes.length > 0) {

    // Rotation naturelle
    matchingRecipes.sort((a, b) => a.lastUsed - b.lastUsed);

    // On prend les 5 moins récentes
    const selectionPool = matchingRecipes.slice(0, 5);

    // Random intelligent
    const forced = shuffle(selectionPool)[0];

    addRecipe(forced);
    forcedRecipeId = forced.id;
  }
}

  // ===== QUOTAS =====
  shuffle(meatRecipes).forEach(r => {
    if (meatCount < meatTarget && !selected.some(s => s.id === r.id)) {
      addRecipe(r);
    }
  });

  shuffle(fishRecipes).forEach(r => {
    if (fishCount < fishTarget && !selected.some(s => s.id === r.id)) {
      addRecipe(r);
    }
  });

  shuffle(vegetarianRecipes).forEach(r => {
    if (vegCount < vegetarianTarget && !selected.some(s => s.id === r.id)) {
      addRecipe(r);
    }
  });

  // ===== COMPLETER JUSQU'A 10 =====
  shuffle(seasonal).forEach(r => {
    if (selected.length >= 10) return;
    if (!selected.some(s => s.id === r.id) && canAdd(r)) {
      addRecipe(r);
    }
  });

  // ===== MAX 1 RÉPÉTITION =====
  const overlap = selected.filter(r => lastGeneration.includes(r.id));

  if (overlap.length > 1) {
    const allowedRepeatId = shuffle(overlap)[0].id;
    selected = selected.filter(r =>
      !lastGeneration.includes(r.id) || r.id === allowedRepeatId
    );
  }

  selected = selected.slice(0, 10);
  // ===== GARANTIR 10 RECETTES =====
  if (selected.length < 10) {

    const remainingPool = seasonal.filter(r =>
      !selected.some(sel => sel.id === r.id)
    );

    shuffle(remainingPool).forEach(r => {
      if (selected.length < 10 && canAdd(r)) {
        addRecipe(r);
      }
    });
  }
  // ===== AJUSTEMENT PORTIONS + BATCH =====
  selected = selected.map(recipe => {

    const isVeryLong = Number(recipe.prep_time) > 90;
    const isHard = recipe.difficulty === "hard";

    let adjustedServings = recipe.servings;

    if (isVeryLong || isHard) {
      adjustedServings = Math.max(recipe.servings, 4);
    }

    const servingRatio = adjustedServings / recipe.servings;

    return {
      ...recipe,
      adjustedServings,
      isBatchCooking: isVeryLong || isHard,
      isForced: recipe.id === forcedRecipeId,
      ingredients: recipe.ingredients.map(ing => ({
        name: ing.name,
        quantity: ing.quantity * servingRatio * ratio,
        unit: ing.unit,
        category: categorizeIngredient(ing.name)
      }))
    };

  });

  // ===== SHOPPING LIST =====
  const shoppingList = {};

  selected.forEach(recipe => {
    recipe.ingredients.forEach(ingredient => {
      const category = categorizeIngredient(ingredient.name);

      if (!shoppingList[category]) {
        shoppingList[category] = {};
      }

      if (!shoppingList[category][ingredient.name]) {
        shoppingList[category][ingredient.name] = {
          quantity: 0,
          unit: ingredient.unit
        };
      }

      shoppingList[category][ingredient.name].quantity += ingredient.quantity;
    });
  });

  // ===== UPDATE LAST USED =====
  const now = Date.now();

  selected.forEach(sel => {
    const index = allRecipes.findIndex(r => r.id === sel.id);
    if (index !== -1) {
      allRecipes[index].lastUsed = now;
    }
  });

  fs.writeFileSync(
    path.join(__dirname, "data", "recipes.json"),
    JSON.stringify(allRecipes, null, 2)
  );

  fs.writeFileSync(
    "data/last_week.json",
    JSON.stringify(selected.map(r => r.id))
  );

  res.json({
  recipes: selected.map(r => ({
    id: r.id,
    name: r.name,
    prep_time: r.prep_time,
    category: r.category,
    steps: r.steps,
    ingredients: r.ingredients,
    adjustedServings: r.adjustedServings,
    isBatchCooking: r.isBatchCooking,
    isForced: r.isForced
  })),
  shoppingList,
  ignoreSeason   // 👈 on ajoute ça
});

});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
