let currentRecipes = [];

async function generateWeek() {
  const people = document.getElementById("people").value;
  const ingredients = document.getElementById("ingredientsToUse").value;
  const ignoreSeason = document.getElementById("ignoreSeason").checked;

  const response = await fetch(
    `/generate-week?people=${people}&use=${encodeURIComponent(ingredients)}&ignoreSeason=${ignoreSeason}`
  );

  const data = await response.json();

  currentRecipes = data.recipes;

  displayRecipes(currentRecipes);
  updateShoppingList();
}

function displayRecipes(recipes) {
  const container = document.getElementById("recipes");
  container.innerHTML = "";

  recipes.forEach(r => {

    // ===== CARD =====
    const card = document.createElement("div");
    card.className = "card shadow-sm mb-4";

    const cardBody = document.createElement("div");
    cardBody.className = "card-body";
    if (r.isForced) {
      card.classList.add("border-warning", "border-3");
    }
    // ===== TITLE =====
    const title = document.createElement("h5");
    title.className = "card-title";
    title.textContent = r.name;

    // ===== META =====
    const meta = document.createElement("p");
    meta.className = "text-muted";

    let metaText = `<strong>Temps :</strong> ${r.prep_time} min | <strong>Type :</strong> ${r.category}`;

    if (r.isForced) {
      metaText += ` 
        <span class="badge bg-warning text-dark ms-2">
          🟡 Ingrédient à finir
        </span>
      `;
    }

    if (r.isBatchCooking) {
      metaText += ` 
        <span class="badge bg-success ms-2">
          🍽️ ${r.adjustedServings} portions
        </span>
      `;
    }

    meta.innerHTML = metaText;

    // ===== CHECKBOX EXCLUSION =====
    const checkboxDiv = document.createElement("div");
    checkboxDiv.className = "form-check mb-2";

    const excludeCheckbox = document.createElement("input");
    excludeCheckbox.className = "form-check-input";
    excludeCheckbox.type = "checkbox";
    excludeCheckbox.dataset.recipeId = r.id;

    const excludeLabel = document.createElement("label");
    excludeLabel.className = "form-check-label";
    excludeLabel.textContent = "Exclure de la liste de courses";

    excludeCheckbox.addEventListener("change", () => {
      card.classList.toggle("opacity-50", excludeCheckbox.checked);
      updateShoppingList();
    });

    checkboxDiv.appendChild(excludeCheckbox);
    checkboxDiv.appendChild(excludeLabel);

    // ===== INGREDIENTS BUTTON =====
    const ingBtn = document.createElement("button");
    ingBtn.className = "btn btn-outline-primary btn-sm me-2";
    ingBtn.textContent = "Voir ingrédients";

    const ingContainer = document.createElement("div");
    ingContainer.style.display = "none";

    if (Array.isArray(r.ingredients)) {
      const ingList = document.createElement("ul");

      r.ingredients.forEach(ing => {
        const li = document.createElement("li");
        li.textContent = `${ing.name} : ${Math.round(ing.quantity * 100) / 100} ${ing.unit}`;
        ingList.appendChild(li);
      });

      ingContainer.appendChild(ingList);
    }

    ingBtn.addEventListener("click", () => {
      const visible = ingContainer.style.display === "block";
      ingContainer.style.display = visible ? "none" : "block";
      ingBtn.textContent = visible ? "Voir ingrédients" : "Masquer ingrédients";
    });

    // ===== STEPS BUTTON =====
    const stepBtn = document.createElement("button");
    stepBtn.className = "btn btn-outline-secondary btn-sm";
    stepBtn.textContent = "Voir recette";

    const stepContainer = document.createElement("div");
    stepContainer.style.display = "none";

    if (Array.isArray(r.steps)) {
      const stepList = document.createElement("ol");

      r.steps.forEach(step => {
        const li = document.createElement("li");
        li.textContent = step;
        stepList.appendChild(li);
      });

      stepContainer.appendChild(stepList);
    }

    stepBtn.addEventListener("click", () => {
      const visible = stepContainer.style.display === "block";
      stepContainer.style.display = visible ? "none" : "block";
      stepBtn.textContent = visible ? "Voir recette" : "Masquer recette";
    });

    // ===== ASSEMBLAGE =====
    cardBody.appendChild(title);
    cardBody.appendChild(meta);
    cardBody.appendChild(checkboxDiv);
    cardBody.appendChild(ingBtn);
    cardBody.appendChild(stepBtn);
    cardBody.appendChild(ingContainer);
    cardBody.appendChild(stepContainer);

    card.appendChild(cardBody);
    container.appendChild(card);

  });
}

function updateShoppingList() {
  const shopping = {};

  const checkboxes = document.querySelectorAll(".form-check-input");

  const excludedIds = Array.from(checkboxes)
    .filter(cb => cb.checked)
    .map(cb => cb.dataset.recipeId);

  const includedRecipes = currentRecipes.filter(
    r => !excludedIds.includes(r.id)
  );

  includedRecipes.forEach(recipe => {
    recipe.ingredients.forEach(ingredient => {

      const category =
        typeof ingredient.category === "string"
          ? ingredient.category
          : "🧂 Épicerie";

      if (!shopping[category]) {
        shopping[category] = {};
      }

      if (!shopping[category][ingredient.name]) {
        shopping[category][ingredient.name] = {
          quantity: 0,
          unit: ingredient.unit
        };
      }

      shopping[category][ingredient.name].quantity += ingredient.quantity;
    });
  });

  displayShopping(shopping);
}

function displayShopping(list) {
  const container = document.getElementById("shopping");
  container.innerHTML = "";

  for (let category in list) {

    const categoryTitle = document.createElement("h3");
    categoryTitle.className = "mt-4 border-bottom pb-1";
    categoryTitle.textContent = category;
    container.appendChild(categoryTitle);

    const items = list[category];

    for (let item in items) {

      const data = items[item];

      const row = document.createElement("div");
      row.className = "form-check mb-2";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "form-check-input";

      const label = document.createElement("label");
      label.className = "form-check-label";
      label.textContent = `${item} : ${Math.round(data.quantity * 100) / 100} ${data.unit}`;

      // 🎨 effet visuel quand coché
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          label.style.color = "#bbb";
          label.style.textDecoration = "line-through";
        } else {
          label.style.color = "";
          label.style.textDecoration = "";
        }
      });

      row.appendChild(checkbox);
      row.appendChild(label);

      container.appendChild(row);
    }
  }
}
